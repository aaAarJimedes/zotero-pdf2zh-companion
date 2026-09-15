"""Native Windows environment-block regression. Does not submit translations."""
import ctypes as C
from ctypes import wintypes as W
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

class STARTUPINFO(C.Structure):
    _fields_ = [('cb', W.DWORD), ('reserved', W.LPWSTR), ('desktop', W.LPWSTR), ('title', W.LPWSTR), ('x', W.DWORD), ('y', W.DWORD), ('xs', W.DWORD), ('ys', W.DWORD), ('xc', W.DWORD), ('yc', W.DWORD), ('fill', W.DWORD), ('flags', W.DWORD), ('show', W.WORD), ('cb2', W.WORD), ('reserved2', C.c_void_p), ('stdin', W.HANDLE), ('stdout', W.HANDLE), ('stderr', W.HANDLE)]
class PROCESSINFO(C.Structure):
    _fields_ = [('process', W.HANDLE), ('thread', W.HANDLE), ('pid', W.DWORD), ('tid', W.DWORD)]

def launch(command, environment, cwd=None, log_file=None):
    k = C.WinDLL('kernel32', use_last_error=True)
    k.CreateProcessW.argtypes = [W.LPCWSTR, W.LPWSTR, C.c_void_p, C.c_void_p, W.BOOL, W.DWORD, C.c_void_p, W.LPCWSTR, C.POINTER(STARTUPINFO), C.POINTER(PROCESSINFO)]
    k.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]
    k.GetExitCodeProcess.argtypes = [W.HANDLE, C.POINTER(W.DWORD)]
    k.TerminateProcess.argtypes = [W.HANDLE, W.UINT]
    k.CloseHandle.argtypes = [W.HANDLE]
    block = C.create_unicode_buffer('\0'.join(f'{key}={value}' for key, value in environment.items()) + '\0\0')
    cmd = C.create_unicode_buffer(subprocess.list2cmdline(command))
    si = STARTUPINFO(); si.cb = C.sizeof(si)
    streams = []
    if log_file:
        import msvcrt
        streams = [open(os.devnull, 'rb'), open(log_file, 'wb')]
        handles = [msvcrt.get_osfhandle(stream.fileno()) for stream in streams]
        for handle in handles: os.set_handle_inheritable(handle, True)
        si.flags = 0x100
        si.stdin, si.stdout, si.stderr = handles[0], handles[1], handles[1]
    pi = PROCESSINFO()
    try:
        if not k.CreateProcessW(command[0], cmd, None, None, bool(streams), 0x08000400, block, cwd, C.byref(si), C.byref(pi)):
            raise C.WinError(C.get_last_error())
    finally:
        for stream in streams: stream.close()
    return k, pi

def wait(k, pi):
    try:
        if k.WaitForSingleObject(pi.process, 60000) != 0:
            k.TerminateProcess(pi.process, 1)
            raise TimeoutError('native probe timeout')
        code = W.DWORD(); k.GetExitCodeProcess(pi.process, C.byref(code))
        return code.value
    finally:
        k.CloseHandle(pi.thread); k.CloseHandle(pi.process)

def fixed_environment(python, inherited):
    result = subprocess.run(['node', str(Path(__file__).with_name('environment.js')), '--emit'], input=json.dumps({'python': python, 'environment': inherited}), capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)

if __name__ == '__main__':
    if os.name != 'nt':
        raise SystemExit('Windows only')
    with tempfile.TemporaryDirectory(prefix='companion-native-') as folder:
        root = Path(folder) / 'envs' / 'space 环境'
        scripts = root / 'Scripts'; scripts.mkdir(parents=True)
        shutil.copyfile(Path(os.environ['SystemRoot']) / 'System32' / 'cmd.exe', scripts / 'companion-path-probe.exe')
        inherited = {k:v for k,v in os.environ.items() if k.upper() != 'PATH'}
        inherited['Path'] = os.environ['PATH']
        fixed = fixed_environment(str(root / 'python.exe'), inherited)
        old = dict(inherited, PATH=fixed['PATH'])
        probe = "import subprocess,sys\ntry:\n r=subprocess.run(['companion-path-probe.exe','/c','exit','0'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30); sys.exit(r.returncode)\nexcept FileNotFoundError: sys.exit(202)"
        assert wait(*launch([sys.executable, '-c', probe], old)) == 202, 'old bug must reproduce'
        assert wait(*launch([sys.executable, '-c', probe], fixed)) == 0, 'fixed raw environment must work'
        print('Native CreateProcessW: old=FileNotFoundError; fixed=success')
