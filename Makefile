APP_NAME=wott
GREEN := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET := $(shell tput -Txterm sgr0)

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
