ifneq (GNU,$(firstword $(shell $(MAKE) --version)))
  $(error Error: 'make' must be 'GNU make')
endif

SHELL := bash

ifeq (,$(shell command -v curl))
  $(error This Makefile requires the 'curl' command)
endif

YS_VERSION := 0.1.95
YS_PREFIX := /tmp/yamlscript-calva
YS_BIN := $(YS_PREFIX)/bin
YS := ys-$(YS_VERSION)
YS_CLI := $(YS_BIN)/$(YS)

CONFIG := config.yml

SRC_FILES := \
  Makefile \
  bb.edn \
  $(shell find . | grep -E '\.(ys|yaml|bash)$$')

export PATH := $(YS_BIN):$(PATH)
export YSPATH := $(PWD)/lib

#------------------------------------------------------------------------------

SHELLCHECK_URL := \
  https://github.com/koalaman/shellcheck/releases/download/v0.10.0/

ostype := $(shell /bin/bash -c 'echo $$OSTYPE')
machtype := $(shell /bin/bash -c 'echo $$MACHTYPE')

ifneq (,$(findstring linux,$(ostype)))
  SHELLCHECK_URL := $(SHELLCHECK_URL)/shellcheck-v0.10.0.linux.x86_64.tar.xz
else ifneq (,$(findstring darwin,$(ostype)))
  SHELLCHECK_URL := $(SHELLCHECK_URL)/shellcheck-v0.10.0.darwin.aarch64.tar.xz
else
  $(error Unsupported OSTYPE: $(ostype))
endif

SHELLCHECK_CLI := $(YS_BIN)/shellcheck
BASH_FILES := $(shell echo bin/*.bash)


#------------------------------------------------------------------------------

.DELETE_ON_ERROR:

default: build

build: $(CONFIG)

test: shellcheck

env: $(YS_CLI)
	which ys
	ys --version

clean:
	$(RM) _$(CONFIG)
	$(RM) -r shellcheck*

#------------------------------------------------------------------------------

always:
	@true

%.yml: %.ys $(YS_CLI) $(SRC_FILES) always
	@( \
	  echo "# DO NOT EDIT - This file was generated from 'config.ys'."; \
	  echo \
	) > _$@
	$(YS) --load --yaml $< >> _$@
	mv _$@ $@

$(YS_CLI):
	curl -sS https://yamlscript.org/install | \
	  PREFIX=$(YS_PREFIX) VERSION=$(YS_VERSION) BIN=1 bash

shellcheck: $(SHELLCHECK_CLI)
	$@ $(BASH_FILES)
	@echo -e "\e[0;32mPASS - Bash files are shellcheck clean\e[0m"

$(SHELLCHECK_CLI):
	curl -sSLO $(SHELLCHECK_URL)
	tar xf shellcheck-*.tar.xz
	mv shellcheck-*/shellcheck $(YS_BIN)
	$(RM) -r shellcheck*
