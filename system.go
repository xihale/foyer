package main

import (
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// 从 Linux /proc 采样系统资源(纯数据采集模块)。
// 与 Zig 版语义逐字段对齐:静态信息读不到降级空串;mem/load/uptime 读不到整体报错。

type diskMount struct {
	Mount   string  `json:"mount"`
	TotalMB float64 `json:"total_mb"`
	UsedMB  float64 `json:"used_mb"`
}

type sysStats struct {
	CpuPercent  float64     `json:"cpu_percent"`
	CpuCores    int64       `json:"cpu_cores"`
	CpuModel    string      `json:"cpu_model"`
	MemTotalMB  float64     `json:"mem_total_mb"`
	MemUsedMB   float64     `json:"mem_used_mb"`
	SwapTotalMB float64     `json:"swap_total_mb"`
	SwapUsedMB  float64     `json:"swap_used_mb"`
	Disks       []diskMount `json:"disks"`
	Load1       float64     `json:"load_1"`
	Load5       float64     `json:"load_5"`
	Load15      float64     `json:"load_15"`
	UptimeS     int64       `json:"uptime_s"`
	Hostname    string      `json:"hostname"`
	OsName      string      `json:"os_name"`
	Kernel      string      `json:"kernel"`
	NetRxBps    float64     `json:"net_rx_bps"`
	NetTxBps    float64     `json:"net_tx_bps"`
}

// 采样快照(sample 可能被并发调用)
var (
	cpuMu   sync.Mutex
	lastCpu *cpuSnapshot
	netMu   sync.Mutex
	lastNet *netSnapshot
)

type cpuSnapshot struct {
	idle  uint64 // idle + iowait
	total uint64 // 首行所有字段之和
}

type netSnapshot struct {
	ns int64
	rx uint64
	tx uint64
}

func readProcFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// sample 采样一次系统资源;mem/load/uptime 缺失时返回错误(整体 500)。
func sampleStats() (sysStats, error) {
	var st sysStats
	var err error
	if st.CpuPercent, st.CpuCores, err = sampleCpu(); err != nil {
		return st, err
	}
	if st.MemTotalMB, st.MemUsedMB, st.SwapTotalMB, st.SwapUsedMB, err = sampleMem(); err != nil {
		return st, err
	}
	st.Disks = sampleDisks()
	if st.Load1, st.Load5, st.Load15, err = sampleLoad(); err != nil {
		return st, err
	}
	if st.UptimeS, err = sampleUptime(); err != nil {
		return st, err
	}
	if st.NetRxBps, st.NetTxBps, err = sampleNet(); err != nil {
		return st, err
	}
	// 主机静态信息读不到不影响整体,回退空串
	st.CpuModel, _ = sampleCpuModel()
	st.Hostname, _ = sampleLine("/proc/sys/kernel/hostname")
	st.Kernel, _ = sampleLine("/proc/sys/kernel/osrelease")
	st.OsName, _ = sampleOsName()
	return st, nil
}

// /proc/stat 首行差值算使用率;cpuN 行数即逻辑核心数。
func sampleCpu() (percent float64, cores int64, err error) {
	cpuMu.Lock()
	defer cpuMu.Unlock()
	text, err := readProcFile("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	nl := strings.IndexByte(text, '\n')
	if nl < 0 {
		nl = len(text)
	}
	snap, err := parseCpuLine(text[:nl])
	if err != nil {
		return 0, 0, err
	}
	for _, line := range strings.Split(text[nl:], "\n") {
		if len(line) > 3 && strings.HasPrefix(line, "cpu") && line[3] >= '0' && line[3] <= '9' {
			cores++
		}
	}
	prev := lastCpu
	lastCpu = &snap
	if prev == nil {
		return 0, cores, nil // 首次调用没有差值基准
	}
	dTotal := float64(snap.total) - float64(prev.total)
	if !(dTotal > 0) {
		return 0, cores, nil // 时钟未走或异常回绕,按 0 处理
	}
	dIdle := float64(snap.idle) - float64(prev.idle)
	percent = (dTotal - dIdle) / dTotal * 100.0
	if percent < 0 {
		percent = 0
	} else if percent > 100 {
		percent = 100
	}
	return percent, cores, nil
}

// "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
func parseCpuLine(line string) (cpuSnapshot, error) {
	fields := strings.Fields(line)
	if len(fields) < 6 || fields[0] != "cpu" {
		return cpuSnapshot{}, errMalformed("/proc/stat")
	}
	var idle, total uint64
	for i, tok := range fields[1:] {
		v, err := strconv.ParseUint(tok, 10, 64)
		if err != nil {
			return cpuSnapshot{}, errMalformed("/proc/stat")
		}
		total += v
		if i == 3 || i == 4 { // idle + iowait 也算空闲
			idle += v
		}
	}
	if total == 0 {
		return cpuSnapshot{}, errMalformed("/proc/stat")
	}
	return cpuSnapshot{idle: idle, total: total}, nil
}

func sampleMem() (totalMB, usedMB, swapTotalMB, swapUsedMB float64, err error) {
	text, err := readProcFile("/proc/meminfo")
	if err != nil {
		return 0, 0, 0, 0, err
	}
	var totalKB, availKB *uint64
	var swapTotalKB, swapFreeKB uint64
	for _, line := range strings.Split(text, "\n") {
		key, rest, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch key {
		case "MemTotal":
			totalKB = parseKbPtr(rest)
		case "MemAvailable":
			availKB = parseKbPtr(rest)
		case "SwapTotal":
			if v := parseKbPtr(rest); v != nil {
				swapTotalKB = *v
			}
		case "SwapFree":
			if v := parseKbPtr(rest); v != nil {
				swapFreeKB = *v
			}
		}
	}
	if totalKB == nil || availKB == nil {
		return 0, 0, 0, 0, errMalformed("/proc/meminfo")
	}
	// used = Total - Available(可用量含 cache/buffer,更接近真实占用),饱和减
	usedKB := uint64(0)
	if *totalKB > *availKB {
		usedKB = *totalKB - *availKB
	}
	swapUsedKB := uint64(0)
	if swapTotalKB > swapFreeKB {
		swapUsedKB = swapTotalKB - swapFreeKB
	}
	return float64(*totalKB) / 1024.0, float64(usedKB) / 1024.0,
		float64(swapTotalKB) / 1024.0, float64(swapUsedKB) / 1024.0, nil
}

func parseKbPtr(part string) *uint64 {
	fields := strings.Fields(part)
	if len(fields) == 0 {
		return nil
	}
	v, err := strconv.ParseUint(fields[0], 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

// 真实文件系统白名单;tmpfs/proc/sysfs/overlay/squashfs 等一律不算
var realFS = map[string]bool{
	"ext2": true, "ext3": true, "ext4": true, "btrfs": true, "xfs": true,
	"f2fs": true, "zfs": true, "ntfs": true, "ntfs3": true, "vfat": true,
	"exfat": true, "apfs": true, "ufs": true, "jfs": true,
}

// /proc/mounts 把空格等转义为 \040 八进制,这里还原
func unescapeMount(raw string) string {
	if !strings.ContainsRune(raw, '\\') {
		return raw
	}
	var b strings.Builder
	for i := 0; i < len(raw); {
		c := raw[i]
		if c == '\\' && i+3 < len(raw) &&
			isDigit(raw[i+1]) && isDigit(raw[i+2]) && isDigit(raw[i+3]) {
			v := (raw[i+1]-'0')*64 + (raw[i+2]-'0')*8 + (raw[i+3] - '0')
			b.WriteByte(v)
			i += 4
		} else {
			b.WriteByte(c)
			i++
		}
	}
	return b.String()
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

// 真实 FS 挂载点逐个 statfs;btrfs 子卷同设备去重只留第一个;按路径字典序。
func sampleDisks() []diskMount {
	text, err := readProcFile("/proc/mounts")
	if err != nil {
		return []diskMount{}
	}
	var out []diskMount
	seen := map[string]bool{}
	const mb = 1024.0 * 1024.0
	for _, line := range strings.Split(text, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		dev, mountRaw, fstype := fields[0], fields[1], fields[2]
		if dev == "none" || !realFS[fstype] || seen[dev] {
			continue
		}
		seen[dev] = true
		mount := unescapeMount(mountRaw)
		var st syscall.Statfs_t
		if err := syscall.Statfs(mount, &st); err != nil {
			continue // 单个挂载失败跳过,不影响其余
		}
		bsize := float64(st.Bsize)
		totalMB := float64(st.Blocks) * bsize / mb
		// used 按 df 口径取 blocks - bfree(bfree 为文件系统级剩余)
		usedMB := float64(st.Blocks-st.Bfree) * bsize / mb
		if totalMB <= 0 {
			continue
		}
		out = append(out, diskMount{Mount: mount, TotalMB: totalMB, UsedMB: usedMB})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Mount < out[j].Mount })
	if out == nil {
		out = []diskMount{}
	}
	return out
}

func sampleCpuModel() (string, error) {
	text, err := readProcFile("/proc/cpuinfo")
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(text, "\n") {
		if !strings.HasPrefix(line, "model name") {
			continue
		}
		_, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		val = strings.Trim(val, " \t\r")
		if val != "" {
			return val, nil
		}
	}
	return "", nil
}

func sampleLine(path string) (string, error) {
	text, err := readProcFile(path)
	if err != nil {
		return "", err
	}
	nl := strings.IndexByte(text, '\n')
	if nl < 0 {
		nl = len(text)
	}
	return strings.Trim(text[:nl], " \t\r"), nil
}

func sampleOsName() (string, error) {
	text, err := readProcFile("/etc/os-release")
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(text, "\n") {
		if !strings.HasPrefix(line, "PRETTY_NAME=") {
			continue
		}
		val := strings.Trim(line[len("PRETTY_NAME="):], " \t\"")
		if val != "" {
			return val, nil
		}
	}
	return "", nil
}

// /proc/net/dev:求和全部非 lo 网卡的收(第0)/发(第8)字节,与上次调用差分出速率。
// 用真实墙钟间隔而非假设定长轮询;首次调用或间隔 ≤0.5s 返回 0。
func sampleNet() (rxBps, txBps float64, err error) {
	netMu.Lock()
	defer netMu.Unlock()
	text, err := readProcFile("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	rx, tx := netDevTotals(text)
	now := timeNowNanos()
	prev := lastNet
	lastNet = &netSnapshot{ns: now, rx: rx, tx: tx}
	if prev == nil {
		return 0, 0, nil
	}
	dt := float64(now-prev.ns) / 1e9
	if !(dt > 0.5) {
		return 0, 0, nil
	}
	var drx, dtx float64
	if rx >= prev.rx {
		drx = float64(rx - prev.rx) // 计数器回绕按 0 处理
	}
	if tx >= prev.tx {
		dtx = float64(tx - prev.tx)
	}
	return drx / dt, dtx / dt, nil
}

func netDevTotals(text string) (rxSum, txSum uint64) {
	for _, line := range strings.Split(text, "\n") {
		iface, rest, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		iface = strings.Trim(iface, " \t")
		if iface == "" || iface == "lo" {
			continue
		}
		fields := strings.Fields(rest)
		if len(fields) < 9 {
			continue
		}
		if v, e := strconv.ParseUint(fields[0], 10, 64); e == nil {
			rxSum += v
		}
		if v, e := strconv.ParseUint(fields[8], 10, 64); e == nil {
			txSum += v
		}
	}
	return rxSum, txSum
}

func sampleLoad() (float64, float64, float64, error) {
	text, err := readProcFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, err
	}
	return parseLoadAvgText(text)
}

func parseLoadAvgText(text string) (float64, float64, float64, error) {
	nl := strings.IndexByte(text, '\n')
	if nl < 0 {
		nl = len(text)
	}
	fields := strings.Fields(text[:nl])
	if len(fields) < 3 {
		return 0, 0, 0, errMalformed("/proc/loadavg")
	}
	var out [3]float64
	for i := 0; i < 3; i++ {
		v, err := strconv.ParseFloat(fields[i], 64)
		if err != nil {
			return 0, 0, 0, errMalformed("/proc/loadavg")
		}
		out[i] = v
	}
	return out[0], out[1], out[2], nil
}

func sampleUptime() (int64, error) {
	text, err := readProcFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	nl := strings.IndexByte(text, '\n')
	if nl < 0 {
		nl = len(text)
	}
	fields := strings.Fields(text[:nl])
	if len(fields) == 0 {
		return 0, errMalformed("/proc/uptime")
	}
	up, err := strconv.ParseFloat(fields[0], 64)
	if err != nil || up < 0 {
		return 0, errMalformed("/proc/uptime")
	}
	return int64(up), nil
}

type malformedError string

func (e malformedError) Error() string { return "malformed " + string(e) }

func errMalformed(what string) error { return malformedError(what) }

func timeNowNanos() int64 { return time.Now().UnixNano() }
