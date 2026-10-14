// Compiler flags shared by the pack builder (Node) and the in-app compiler (browser).
// They mirror arduino:renesas_uno 1.6.0 for the UNO R4 WiFi (platform.txt), adapted for clang.
export const CPU = ['--target=arm-none-eabi', '-mcpu=cortex-m4', '-mthumb', '-mfloat-abi=hard', '-mfpu=fpv4-sp-d16'];
export const DEFINES = ['-DF_CPU=48000000', '-DNO_USB', '-DBACKTRACE_SUPPORT', '-DARDUINO_UNOR4_WIFI', '-DARDUINO=10607',
  '-DARDUINO_UNOWIFIR4', '-DARDUINO_ARCH_RENESAS_UNO', '-DARDUINO_ARCH_RENESAS', '-DARDUINO_FSP', '-D_XOPEN_SOURCE=700',
  '-D_RA_CORE=CM4', '-D_RENESAS_RA_', '-DCFG_TUSB_MCU=OPT_MCU_RAXXX'];
const FSP_INC = ['ra/fsp/inc', 'ra/fsp/inc/api', 'ra/fsp/inc/instances', 'ra/arm/CMSIS_5/CMSIS/Core/Include', 'ra_gen',
  'ra_cfg/fsp_cfg/bsp', 'ra_cfg/fsp_cfg', 'ra/fsp/src/r_usb_basic/src/driver/inc'];
export const CORE_INC = ['/hw/cores/arduino/tinyusb', '/hw/cores/arduino/api/deprecated', '/hw/cores/arduino/api/deprecated-avr-comp',
  '/hw/cores/arduino', '/hw/variants/UNOWIFIR4'].map(p => '-I' + p)
  .concat(FSP_INC.map(p => '-I/hw/variants/UNOWIFIR4/includes/' + p));
const GCC = '/gcc/arm-none-eabi/include';
export const SYS_INC = ['-nostdinc', '-isystem', '/usr/lib/clang/21/include',
  '-isystem', GCC + '/c++/7.2.1', '-isystem', GCC + '/c++/7.2.1/arm-none-eabi/thumb/v7e-m/fpv4-sp/hard',
  '-isystem', GCC + '/c++/7.2.1/backward', '-isystem', GCC];
// gcc's arm-none-eabi makes int32_t a long; clang makes it an int. Match gcc so Arduino code
// (and its overloads) compiles the same way.
const GCC_TYPES = ['-U__INT32_TYPE__', '-D__INT32_TYPE__=long int', '-U__UINT32_TYPE__', '-D__UINT32_TYPE__=long unsigned int',
  '-U__INT_LEAST32_TYPE__', '-D__INT_LEAST32_TYPE__=long int', '-U__UINT_LEAST32_TYPE__', '-D__UINT_LEAST32_TYPE__=long unsigned int'];
// gcc 7 accepted these in C; recent clang makes them errors
const C_LENIENT = ['-Wno-error=return-mismatch', '-Wno-error=implicit-function-declaration', '-Wno-error=int-conversion',
  '-Wno-error=incompatible-pointer-types', '-Wno-error=implicit-int'];
export const COMMON = [...GCC_TYPES, '-Os', '-ffunction-sections', '-fdata-sections', '-fsigned-char', '-fno-builtin',
  '-Wno-unknown-attributes', '-Wno-ignored-attributes', '-Wno-error=c++11-narrowing'];
export const CFLAGS = [...CPU, '-std=gnu11', ...COMMON, ...C_LENIENT, ...DEFINES, ...SYS_INC];
export const CXXFLAGS = [...CPU, '-std=gnu++17', '-fno-rtti', '-fno-exceptions', '-fno-use-cxa-atexit', '-fno-threadsafe-statics', ...COMMON, ...DEFINES, ...SYS_INC];

// Runtime libraries from Arduino's arm-none-eabi-gcc 7-2017q4 (newlib-nano, hard-float Cortex-M4).
// The pack keeps them in /rt under the names fsp.ld's GROUP() asks for.
export const RUNTIME = {
  crti: '/rt/crti.o', crtbegin: '/rt/crtbegin.o', crtend: '/rt/crtend.o', crtn: '/rt/crtn.o',
  libc: '/rt/libc.a', libm: '/rt/libm.a', libgcc: '/rt/libgcc.a', libnosys: '/rt/libnosys.a',
  libstdcxx: '/rt/libstdc++_nano.a', libsupcxx: '/rt/libsupc++_nano.a'
};
export const VARIANT_OBJS = ['/out/common_data.c.o', '/out/main.c.o', '/out/pin_data.c.o', '/out/variant.cpp.o'];
export const FLASH_MAX = 262144, RAM_MAX = 32768;
