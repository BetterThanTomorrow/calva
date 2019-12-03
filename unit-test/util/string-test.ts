import { expect } from 'chai';
import {keywordize, unKeywordize} from '../../src/util/string';

// TODO: Hook this into the CI pipeline

describe('keywordize', function() {
  it('keywordizes non-keywords', function() {
    expect(":test").equal(keywordize("test"));
  }); 
  it('leaves keywords alone', function() {
    expect(":test").equal(keywordize(":test"));
  }); 
});

describe('unKeywordize', function() {
  it('un-keywordizes keywords', function() {
    expect("test").equal(unKeywordize(":test"));
  }); 
  it('leaves non-keywords alone', function() {
    expect("test").equal(unKeywordize("test"));
  }); 
});