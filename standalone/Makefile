.PHONY: help build build-prod test package clean install

help:
	@echo "OAuth2APIlocal Standalone - Build Commands"
	@echo ""
	@echo "  make build       - Build development version"
	@echo "  make build-prod  - Build production version (minified)"
	@echo "  make test        - Run unit tests"
	@echo "  make package     - Create cross-platform binaries"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make install     - Install dependencies"
	@echo ""

install:
	npm install

build:
	npm run build

build-prod:
	npm run build:prod

test:
	npm test

package: build-prod
	npm run package
	@echo ""
	@echo "Binaries created in bin/:"
	@ls -lh bin/

clean:
	npm run clean

all: install build test
