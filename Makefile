APP_NAME=wott
GREEN := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET := $(shell tput -Txterm sgr0)

# Android toolchain (command-line SDK via Homebrew; JDK pinned for Gradle in
# ~/.gradle/gradle.properties). Override with env vars if yours lives elsewhere.
ANDROID_HOME ?= /opt/homebrew/share/android-commandlinetools
JAVA_HOME ?= /opt/homebrew/opt/openjdk@21
export ANDROID_HOME
export JAVA_HOME
export PATH := $(JAVA_HOME)/bin:$(ANDROID_HOME)/platform-tools:$(ANDROID_HOME)/emulator:$(PATH)

.DEFAULT_GOAL := help

# 🧩 Local Development

run: ## Start the Vite dev server (browser)
	npm run dev

setup: install build sync ## Full setup: install deps, build, sync native shells

install: ## Install dependencies
	npm install

# 📱 Native shells

build: ## Build the static SPA bundle into build/
	npm run build

sync: build ## Rebuild and copy web assets into the iOS/Android projects
	npx cap sync

ios: sync ## Open/run the app in the iOS simulator (needs Xcode)
	npx cap run ios

android: sync ## Open/run the app in an Android emulator (needs Android SDK)
	npx cap run android

android.local: ## Run on the Android emulator against a LOCAL whatisonthe.tv backend
	@# Needs: backend running on :8000 with CORS for device builds — start it
	@# with script/local-backend.sh. Boots the emulator first if none is running.
	VITE_API_BASE=http://10.0.2.2:8000/api npm run build
	CAP_DEV_CLEARTEXT=1 npx cap sync android
	@target=$$(adb devices | awk 'NR>1 && $$2=="device" {print $$1; exit}'); \
	if [ -z "$$target" ]; then \
		echo "$(YELLOW)no emulator running — booting wott AVD…$(RESET)"; \
		$(ANDROID_HOME)/emulator/emulator -avd wott -no-snapshot-save > /dev/null 2>&1 & \
		adb wait-for-device; \
		until [ "$$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done; \
		target=$$(adb devices | awk 'NR>1 && $$2=="device" {print $$1; exit}'); \
	fi; \
	CAP_DEV_CLEARTEXT=1 npx cap run android --target $$target

ios.local: ## Run on the iOS Simulator against a LOCAL whatisonthe.tv backend
	@# iOS ATS exempts localhost, and capacitor://localhost is in the backend's
	@# CORS defaults — so no cleartext flag needed, unlike Android.
	VITE_API_BASE=http://localhost:8000/api npm run build
	npx cap sync ios
	npx cap run ios

emulator: ## Boot the wott Android emulator (leave it running)
	$(ANDROID_HOME)/emulator/emulator -avd wott -no-snapshot-save > /dev/null 2>&1 &

# 🧪 Testing

test: ## Run unit tests (vitest)
	npm test

# 🔍 Linting & Checks

lint: ## Lint (prettier check + eslint)
	npm run lint

lint.fix: ## Auto-format with prettier
	npm run format

typecheck: ## svelte-check + TypeScript
	npm run check

check: lint typecheck test ## All checks — the gate before any push

# 📖 Help

help: ## Show all available make targets
	@echo "$(GREEN)$(APP_NAME) - Available targets:$(RESET)"
	@grep -E '^[a-zA-Z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}'
