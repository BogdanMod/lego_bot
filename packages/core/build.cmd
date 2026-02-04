@echo off
setlocal

echo Building @dialogue-constructor/core with dependencies...

cd /d %~dp0..\..

rem Vercel already installs dependencies.
rem Safety net: only run npm ci if we're on Vercel/CI AND node_modules is unexpectedly missing.
rem (Avoids wasted time + potential conflicts with pnpm/yarn on local machines.)
if "%VERCEL%"=="1" goto _maybeInstall
if "%CI%"=="1" goto _maybeInstall
goto _afterInstall

:_maybeInstall
if not exist node_modules (
  echo Installing dependencies ^(unexpected missing node_modules on CI/Vercel^)...
  call npm ci
)

:_afterInstall
echo Building @dialogue-constructor/shared...
call npx turbo run build --filter=@dialogue-constructor/shared

if not exist packages\core\node_modules\@dialogue-constructor mkdir packages\core\node_modules\@dialogue-constructor

rem PATCH (CI/Vercel only):
rem We copy built artifacts into core\node_modules so the serverless runtime can resolve
rem @dialogue-constructor/shared\dist* files. Doing this locally can break workspace/pnpm symlinks.
if not "%VERCEL%"=="1" if not "%CI%"=="1" (
  echo Local run: skipping node_modules patch ^(to avoid breaking workspace/pnpm symlinks^).
  goto _afterPatch
)

if exist packages\core\node_modules\@dialogue-constructor\shared (
  rmdir /s /q packages\core\node_modules\@dialogue-constructor\shared
)

mkdir packages\core\node_modules\@dialogue-constructor\shared

rem If shared starts shipping additional runtime assets (types, schemas, wasm, json, templates, etc.),
rem extend the copy list below accordingly.
echo (CI/Vercel) Copying built shared package to core/node_modules...
xcopy /E /I /Y packages\shared\dist packages\core\node_modules\@dialogue-constructor\shared\dist
xcopy /E /I /Y packages\shared\dist-cjs packages\core\node_modules\@dialogue-constructor\shared\dist-cjs
copy /Y packages\shared\package.json packages\core\node_modules\@dialogue-constructor\shared\

rem Fail-fast: ensure the expected entrypoint exists after copy
if not exist packages\core\node_modules\@dialogue-constructor\shared\dist-cjs\index.js (
  echo ERROR: Expected shared entrypoint missing: packages\core\node_modules\@dialogue-constructor\shared\dist-cjs\index.js
  echo Ensure shared build outputs dist-cjs and extend the copy list for any extra artifacts if needed.
  exit /b 1
)

:_afterPatch
echo Building @dialogue-constructor/core...
cd packages\core
call npx tsc

echo Build complete!
