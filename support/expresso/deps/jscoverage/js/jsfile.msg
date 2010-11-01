/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/*
        Error messages for jsfile.c. See js.msg for format specification.
*/

MSG_DEF(JSFILEMSG_NOT_AN_ERROR,                                    0, 0, JSEXN_NONE, "<Error #0 is reserved>")
MSG_DEF(JSFILEMSG_FILE_CONSTRUCTOR_UNDEFINED_ERROR,                1, 0, JSEXN_NONE, "File constructor is undefined")
MSG_DEF(JSFILEMSG_FILE_CURRENTDIR_UNDEFINED_ERROR,                 2, 0, JSEXN_NONE, "File.currentDir is undefined")
MSG_DEF(JSFILEMSG_FIRST_ARGUMENT_OPEN_NOT_STRING_ERROR,            3, 1, JSEXN_NONE, "The first argument {0} to file.open must be a string")
MSG_DEF(JSFILEMSG_SECOND_ARGUMENT_OPEN_NOT_STRING_ERROR,           4, 0, JSEXN_NONE, "The second argument to file.open must be a string")
MSG_DEF(JSFILEMSG_CANNOT_COPY_FILE_OPEN_FOR_WRITING_ERROR,         5, 1, JSEXN_NONE, "Cannot copy file {0} open for writing")
MSG_DEF(JSFILEMSG_CANNOT_ACCESS_FILE_INFO_ERROR,                   6, 1, JSEXN_NONE, "Cannot access file information for {0}")
MSG_DEF(JSFILEMSG_COPY_READ_ERROR,                                 7, 1, JSEXN_NONE, "An error occured while attempting to read a file {0} to copy")
MSG_DEF(JSFILEMSG_COPY_WRITE_ERROR,                                8, 1, JSEXN_NONE, "An error occured while attempting to copy into file {0}")
MSG_DEF(JSFILEMSG_EXPECTS_ONE_ARG_ERROR,                           9, 0, JSEXN_NONE, "Operation {0} expects one argument, not {1}")
MSG_DEF(JSFILEMSG_CANNOT_FLUSH_CLOSE_FILE_ERROR,                  10, 1, JSEXN_NONE, "Cannot flush closed file {0}")
MSG_DEF(JSFILEMSG_CANNOT_OPEN_WRITING_ERROR,                      11, 1, JSEXN_NONE, "Cannot open file {0} for writing")
MSG_DEF(JSFILEMSG_WRITEALL_EXPECTS_ONE_ARG_ERROR,                 12, 0, JSEXN_NONE, "writeAll expects one argument")
MSG_DEF(JSFILEMSG_FIRST_ARGUMENT_WRITEALL_NOT_ARRAY_ERROR,        13, 0, JSEXN_NONE, "writeAll expects an array as an argument")
MSG_DEF(JSFILEMSG_UNUSED0,                                        14, 0, JSEXN_NONE, "Unused error message slot")
MSG_DEF(JSFILEMSG_CANNOT_OPEN_FILE_ERROR,                         15, 1, JSEXN_NONE, "Cannot open file {0}")
MSG_DEF(JSFILEMSG_FIRST_ARGUMENT_CONSTRUCTOR_NOT_STRING_ERROR,    16, 1, JSEXN_NONE, "The argument to the File constructor {0} must be a string")
MSG_DEF(JSFILEMSG_BIDIRECTIONAL_PIPE_NOT_SUPPORTED,               17, 0, JSEXN_NONE, "Bidirectional pipes are not supported")
MSG_DEF(JSFILEMSG_OPEN_MODE_NOT_SUPPORTED_WITH_PIPES,             18, 2, JSEXN_NONE, "The opening mode you have chosen {0} is not supported by the pipe you are trying to open: {1}")
MSG_DEF(JSFILEMSG_OPEN_FAILED,                                    19, 1, JSEXN_NONE, "open on file {0} failed")
MSG_DEF(JSFILEMSG_CLOSE_FAILED,                                   20, 1, JSEXN_NONE, "close on file {0} failed")
MSG_DEF(JSFILEMSG_PCLOSE_FAILED,                                  21, 1, JSEXN_NONE, "pclose on file {0} failed")
MSG_DEF(JSFILEMSG_REMOVE_FAILED,                                  22, 1, JSEXN_NONE, "remove on file {0} failed")
MSG_DEF(JSFILEMSG_CANNOT_ACCESS_FILE_STATUS,                      23, 1, JSEXN_NONE, "Cannot access file status for {0}")
MSG_DEF(JSFILEMSG_RENAME_FAILED,                                  24, 2, JSEXN_NONE, "Cannot rename {0} to {1}")
MSG_DEF(JSFILEMSG_WRITE_FAILED,                                   25, 1, JSEXN_NONE, "Write failed on file {0}")
MSG_DEF(JSFILEMSG_READ_FAILED,                                    26, 1, JSEXN_NONE, "Read failed on file {0}")
MSG_DEF(JSFILEMSG_SKIP_FAILED,                                    27, 1, JSEXN_NONE, "Skip failed on file {0}")
MSG_DEF(JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_FUNCTION_OR_REGEX,     28, 1, JSEXN_NONE, "The first argument to file.list must be a function or a regex")
MSG_DEF(JSFILEMSG_CANNOT_DO_LIST_ON_A_FILE,                       29, 1, JSEXN_NONE, "{0} must be a directory, cannot do list")
MSG_DEF(JSFILEMSG_NATIVE_OPERATION_IS_NOT_SUPPORTED,              30, 2, JSEXN_NONE, "Native operation {0} is not supported on {1}")
MSG_DEF(JSFILEMSG_CANNOT_SET_PRIVATE_FILE,                        31, 1, JSEXN_NONE, "Cannot set private data for file {0}")
MSG_DEF(JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_NUMBER,                32, 2, JSEXN_NONE, "First argument to {0} must be a number, not {1}")
MSG_DEF(JSFILEMSG_CANNOT_WRITE,                                   33, 1, JSEXN_NONE, "Cannot write to {0}, file mode is different")
MSG_DEF(JSFILEMSG_CANNOT_READ,                                    34, 1, JSEXN_NONE, "Cannot read from {0}, file mode is different")
MSG_DEF(JSFILEMSG_CANNOT_FLUSH,                                   35, 1, JSEXN_NONE, "Flush failed on {0}")
MSG_DEF(JSFILEMSG_OP_FAILED,									  36, 1, JSEXN_NONE, "File operation {0} failed")
MSG_DEF(JSFILEMSG_FILE_MUST_BE_OPEN,							  37, 1, JSEXN_NONE, "File must be open for {0}")
MSG_DEF(JSFILEMSG_FILE_MUST_BE_CLOSED,							  38, 1, JSEXN_NONE, "File must be closed for {0}")
MSG_DEF(JSFILEMSG_NO_RANDOM_ACCESS,								  39, 1, JSEXN_NONE, "File {0} doesn't allow random access")
MSG_DEF(JSFILEMSG_OBJECT_CREATION_FAILED,						  40, 1, JSEXN_NONE, "Couldn't create {0}")
MSG_DEF(JSFILEMSG_CANNOT_OPEN_DIR,								  41, 1, JSEXN_NONE, "Couldn't open directory {0}")
MSG_DEF(JSFILEMSG_CANNOT_REPORT_POSITION,						  42, 1, JSEXN_NONE, "Couldn't report position for {0}")
MSG_DEF(JSFILEMSG_CANNOT_SET_POSITION,							  43, 1, JSEXN_NONE, "Couldn't set position for {0}")
MSG_DEF(JSFILEMSG_INIT_FAILED,									  44, 0, JSEXN_NONE, "File class initialization failed")


