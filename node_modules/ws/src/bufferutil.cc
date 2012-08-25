/*!
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 */

#include <v8.h>
#include <node.h>
#include <node_buffer.h>
#include <node_object_wrap.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>
#include <stdio.h>

using namespace v8;
using namespace node;

class BufferUtil : public ObjectWrap
{
public:

  static void Initialize(v8::Handle<v8::Object> target)
  {
    HandleScope scope;
    Local<FunctionTemplate> t = FunctionTemplate::New(New);
    t->InstanceTemplate()->SetInternalFieldCount(1);
    NODE_SET_METHOD(t->GetFunction(), "unmask", BufferUtil::Unmask);
    NODE_SET_METHOD(t->GetFunction(), "mask", BufferUtil::Mask);
    NODE_SET_METHOD(t->GetFunction(), "merge", BufferUtil::Merge);
    target->Set(String::NewSymbol("BufferUtil"), t->GetFunction());
  }

protected:

  static Handle<Value> New(const Arguments& args)
  {
    HandleScope scope;
    BufferUtil* bufferUtil = new BufferUtil();
    bufferUtil->Wrap(args.This());
    return args.This();
  }

  static Handle<Value> Merge(const Arguments& args)
  {
    HandleScope scope;
    Local<Object> bufferObj = args[0]->ToObject();
    char* buffer = Buffer::Data(bufferObj);
    Local<Array> array = Local<Array>::Cast(args[1]);
    unsigned int arrayLength = array->Length();
    unsigned int offset = 0;
    unsigned int i;
    for (i = 0; i < arrayLength; ++i) {
      Local<Object> src = array->Get(i)->ToObject();
      unsigned int length = Buffer::Length(src);
      memcpy(buffer + offset, Buffer::Data(src), length);
      offset += length;
    }
    return scope.Close(True());
  }

  static Handle<Value> Unmask(const Arguments& args)
  {
    HandleScope scope;
    Local<Object> buffer_obj = args[0]->ToObject();
    unsigned int length = Buffer::Length(buffer_obj);
    Local<Object> mask_obj = args[1]->ToObject();
    unsigned int *mask = (unsigned int*)Buffer::Data(mask_obj);
    unsigned int* from = (unsigned int*)Buffer::Data(buffer_obj);
    unsigned int len32 = length / 4;
    unsigned int i;
    for (i = 0; i < len32; ++i) *(from + i) ^= *mask;
    from += i;
    switch (length % 4) {
      case 3: *((unsigned char*)from+2) = *((unsigned char*)from+2) ^ ((unsigned char*)mask)[2];
      case 2: *((unsigned char*)from+1) = *((unsigned char*)from+1) ^ ((unsigned char*)mask)[1];
      case 1: *((unsigned char*)from  ) = *((unsigned char*)from  ) ^ ((unsigned char*)mask)[0];
      case 0:;
    }
    return True();
  }

  static Handle<Value> Mask(const Arguments& args)
  {
    HandleScope scope;
    Local<Object> buffer_obj = args[0]->ToObject();
    Local<Object> mask_obj = args[1]->ToObject();
    unsigned int *mask = (unsigned int*)Buffer::Data(mask_obj);
    Local<Object> output_obj = args[2]->ToObject();
    unsigned int dataOffset = args[3]->Int32Value();
    unsigned int length = args[4]->Int32Value();
    unsigned int* to = (unsigned int*)(Buffer::Data(output_obj) + dataOffset);
    unsigned int* from = (unsigned int*)Buffer::Data(buffer_obj);
    unsigned int len32 = length / 4;
    unsigned int i;
    for (i = 0; i < len32; ++i) *(to + i) = *(from + i) ^ *mask;
    to += i;
    from += i;
    switch (length % 4) {
      case 3: *((unsigned char*)to+2) = *((unsigned char*)from+2) ^ *((unsigned char*)mask+2);
      case 2: *((unsigned char*)to+1) = *((unsigned char*)from+1) ^ *((unsigned char*)mask+1);
      case 1: *((unsigned char*)to  ) = *((unsigned char*)from  ) ^ *((unsigned char*)mask);
      case 0:;
    }
    return True();
  }
};

extern "C" void init (Handle<Object> target)
{
  HandleScope scope;
  BufferUtil::Initialize(target);
}

NODE_MODULE(bufferutil, init)
