CC = gcc
CXX = g++
LD = g++
OS_CFLAGS = -DXP_WIN -DEXPORT_JS_API=1
RANLIB = ranlib
MKSHLIB = $(LD) -shared $(XMKSHLIBOPTS)
OTHER_LIBS = -lwinmm
