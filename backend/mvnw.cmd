@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup batch script, version 3.3.2
@REM
@REM Required ENV vars:
@REM ------------------
@REM   JAVA_HOME - location of a JDK home dir
@REM
@REM Optional ENV vars
@REM -----------------
@REM   MAVEN_OPTS - parameters passed to the Java VM when running Maven
@REM     e.g. to debug Maven itself, use
@REM       set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
@REM   MAVEN_SKIP_RC - flag to disable loading of mavenrc files
@REM ----------------------------------------------------------------------------

@IF "%OS%"=="Windows_NT" @SETLOCAL
@IF "%OS%"=="Windows_NT" @SET "MAVEN_CMD_LINE_ARGS=%*"

set ERROR_CODE=0

:init
@REM Decide how to startup depending on the version of windows

@REM -- Windows NT with Temp Dir --
if not "%OS%"=="Windows_NT" goto Win9xArg
if "%@eval[2+2]" == "4" goto 4NTArgs

@REM -- Regular Windows NT --
set MAVEN_CMD_LINE_ARGS=%*
goto WinNTGetScriptDir

:4NTArgs
@REM -- 4NT / Take Command --
set MAVEN_CMD_LINE_ARGS=%$
goto WinNTGetScriptDir

:WinNTGetScriptDir
set MAVEN_PROJECTBASEDIR=%~dp0
IF NOT "%MAVEN_PROJECTBASEDIR:~-1%" == "\" (set MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR%\)
goto chkMvn

:Win9xArg
@REM Slurp the command line arguments.  This loop allows for an unlimited number
@REM of arguments (up to the command line limit, anyway).
set MAVEN_CMD_LINE_ARGS=
:Win9xApp
if %1a==a goto Win9xGetScriptDir
set MAVEN_CMD_LINE_ARGS=%MAVEN_CMD_LINE_ARGS% %1
shift
goto Win9xApp

:Win9xGetScriptDir
set MAVEN_PROJECTBASEDIR=%0\..
goto chkMvn

:chkMvn
set _MAVEN_WRAPPERJAR="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
set _MAVEN_WRAPPERPROPFILE="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties"

SET MVNW_VERBOSE=false
if not "%MVNW_VERBOSE%" == "false" (
  echo Classpath: %_MAVEN_WRAPPERJAR%
  echo ProjectDir: %MAVEN_PROJECTBASEDIR%
)

if exist %_MAVEN_WRAPPERJAR% (
  goto runWithJavaHome
)

echo Couldn't find %_MAVEN_WRAPPERJAR%, downloading it ...

if not "%MVNW_REPOURL%" == "" (
  SET _MVNW_REPO_URL=%MVNW_REPOURL%
) else (
  SET _MVNW_REPO_URL=https://repo.maven.apache.org/maven2
)

SET _WRAPPER_URL=%_MVNW_REPO_URL%/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%_WRAPPER_URL%', String.Format('{0}', '%_MAVEN_WRAPPERJAR%'))"
if "%ERRORLEVEL%"=="0" goto runWithJavaHome

echo Failed to download wrapper jar. Using manual approach...
goto error

:runWithJavaHome
if not "%JAVA_HOME%" == "" goto OkJHome

echo.
echo ERROR: JAVA_HOME not found in your environment.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation
echo.
goto error

:OkJHome
if exist "%JAVA_HOME%\bin\java.exe" goto execute

echo.
echo ERROR: JAVA_HOME is set to an invalid directory.
echo JAVA_HOME = "%JAVA_HOME%"
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation
echo.
goto error

:execute
@REM Start MAVEN Wrapper
set JAVA_EXE=%JAVA_HOME%\bin\java.exe

if not exist "%_MAVEN_WRAPPERJAR%" (
  echo Maven wrapper jar not found, cannot continue.
  goto error
)

"%JAVA_EXE%" %MAVEN_OPTS% %MAVEN_DEBUG_OPTS% -classpath "%_MAVEN_WRAPPERJAR%" "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" org.apache.maven.wrapper.MavenWrapperMain %MAVEN_CMD_LINE_ARGS%
if ERRORLEVEL 1 goto error
goto end

:error
set ERROR_CODE=1

:end
@ENDLOCAL & SET ERROR_CODE=%ERROR_CODE%

if not "%MAVEN_SKIP_RC%" == "" goto skipRcPost
@REM check for post script, once with legacy .bat ending and once with .cmd ending
if exist "%HOME%\mavenrc_post.bat" call "%HOME%\mavenrc_post.bat"
if exist "%HOME%\mavenrc_post.cmd" call "%HOME%\mavenrc_post.cmd"
:skipRcPost

@REM pause the script if MAVEN_BATCH_PAUSE is set to 'on'
if "%MAVEN_BATCH_PAUSE%" == "on" pause

if "%MAVEN_TERMINATE_CMD%" == "on" exit %ERROR_CODE%

cmd /C exit /B %ERROR_CODE%
