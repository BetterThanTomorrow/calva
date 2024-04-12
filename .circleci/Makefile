SHELL := bash

YS_VERSION := 0.1.54
YS_PREFIX := /tmp/yamlscript
YS_BIN := $(YS_PREFIX)/bin
YS_CLI := $(YS_BIN)/ys

SRC_FILES := \
  Makefile \
  $(shell find . | grep -E '\.(ys|yaml|bash)$$')

export PATH := $(YS_BIN):$(PATH)
export YSPATH := $(PWD)/lib

CONFIG := config.yml

.DELETE_ON_ERROR:

default: build

build: $(CONFIG)

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

clean:
	$(RM) $(CONFIG) _$(CONFIG)
