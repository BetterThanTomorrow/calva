SHELL := bash

YS_VERSION := 0.1.54
YS_PREFIX := /tmp/yamlscript
YS_BIN := $(YS_PREFIX)/bin
YS_CLI := $(YS_BIN)/ys

CONFIG := config.yml

SRC_FILES := \
  Makefile \
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

clean:
	$(RM) $(CONFIG) _$(CONFIG)
	$(RM) -r shellcheck*

%.yml: %.ys $(YS_CLI) $(SRC_FILES)
	@( \
	  echo "# DO NOT EDIT - This file was generated from 'config.ys'."; \
	  echo \
	) > _$@
	ys --load --yaml --ordered $< >> _$@
	mv _$@ $@

$(YS_CLI):
	curl -sS https://yamlscript.org/install | \
	  PREFIX=$(YS_PREFIX) VERSION=$(YS_VERSION) BIN=1 bash

shellcheck: $(SHELLCHECK_CLI)
	$< $(BASH_FILES)
	@echo 'PASS - Bash files are shellcheck clean'

$(SHELLCHECK_CLI):
	curl -sSLO $(SHELLCHECK_URL)
	tar xf shellcheck-*.tar.xz
	mv shellcheck-*/shellcheck $(YS_BIN)
	$(RM) -r shellcheck*
