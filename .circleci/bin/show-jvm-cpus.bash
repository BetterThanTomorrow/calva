echo "nproc: $(nproc)"
if [[ -f /sys/fs/cgroup/cpu.max ]]; then
  echo "cgroup v2 cpu.max: $(cat /sys/fs/cgroup/cpu.max)"
else
  echo "cgroup v1 cfs_quota_us: $(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us 2>/dev/null)"
  echo "cgroup v1 cfs_period_us: $(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us 2>/dev/null)"
  echo "cgroup v1 shares: $(cat /sys/fs/cgroup/cpu/cpu.shares 2>/dev/null)"
fi
java -XshowSettings:system -version 2>&1
java -XX:+PrintFlagsFinal -version 2>/dev/null |
  grep -E ' (ActiveProcessorCount|CICompilerCount|ParallelGCThreads|ConcGCThreads|UseSerialGC|UseG1GC) ' ||
  true
