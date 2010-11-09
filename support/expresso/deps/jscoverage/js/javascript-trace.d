/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/*
 * javascript provider probes
 *
 * function-entry       (filename, classname, funcname)
 * function-info        (filename, classname, funcname, lineno,
 *                      runfilename, runlineno)
 * function-args        (filename, classname, funcname, argc, argv, argv0,
 *                      argv1, argv2, argv3, argv4)
 * function-rval        (filename, classname, funcname, lineno, rval, rval0)
 * function-return      (filename, classname, funcname)
 * object-create-start  (filename, classname)
 * object-create        (filename, classname, *object, rlineno)
 * object-create-done   (filename, classname)
 * object-finalize      (NULL, classname, *object)
 * execute-start        (filename, lineno)
 * execute-done         (filename, lineno)
 */

provider javascript {
 probe function__entry(char *, char *, char *);
 probe function__info(char *, char *, char *, int, char *, int);
 probe function__args(char *, char *, char *, int, void *, void *, void *,
     void *, void *, void *);
 probe function__rval(char *, char *, char *, int, void *, void *);
 probe function__return(char *, char *, char *);
 probe object__create__start(char *, char *);
 probe object__create__done(char *, char *);
 /* XXX must use unsigned longs here instead of uintptr_t for OS X 
    (Apple radar: 5194316 & 5565198) */
 probe object__create(char *, char *, unsigned long, int);
 probe object__finalize(char *, char *, unsigned long);
 probe execute__start(char *, int);
 probe execute__done(char *, int);
};

/*
#pragma D attributes Unstable/Unstable/Common provider mozilla provider
#pragma D attributes Private/Private/Unknown provider mozilla module
#pragma D attributes Private/Private/Unknown provider mozilla function
#pragma D attributes Unstable/Unstable/Common provider mozilla name
#pragma D attributes Unstable/Unstable/Common provider mozilla args
*/

