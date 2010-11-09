/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=80:
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Copyright (C) 2007  Sun Microsystems, Inc. All Rights Reserved.
 *
 * Contributor(s):
 *      Brendan Eich <brendan@mozilla.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "javascript-trace.h"
#include "jspubtd.h"
#include "jsprvtd.h"

#ifndef _JSDTRACEF_H
#define _JSDTRACEF_H

JS_BEGIN_EXTERN_C

extern void
jsdtrace_function_entry(JSContext *cx, JSStackFrame *fp, JSFunction *fun);

extern void
jsdtrace_function_info(JSContext *cx, JSStackFrame *fp, JSStackFrame *dfp,
                       JSFunction *fun);

extern void
jsdtrace_function_args(JSContext *cx, JSStackFrame *fp, JSFunction *fun);

extern void
jsdtrace_function_rval(JSContext *cx, JSStackFrame *fp, JSFunction *fun);

extern void
jsdtrace_function_return(JSContext *cx, JSStackFrame *fp, JSFunction *fun);

extern void
jsdtrace_object_create_start(JSStackFrame *fp, JSClass *clasp);

extern void
jsdtrace_object_create_done(JSStackFrame *fp, JSClass *clasp);

extern void
jsdtrace_object_create(JSContext *cx, JSClass *clasp, JSObject *obj);

extern void
jsdtrace_object_finalize(JSObject *obj);

extern void
jsdtrace_execute_start(JSScript *script);

extern void
jsdtrace_execute_done(JSScript *script);

JS_END_EXTERN_C

#endif /* _JSDTRACE_H */
