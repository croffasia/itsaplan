import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedImageStyle } from './imageStyle';

describe('allowedImageStyle', () => {
  it('drops every declaration that could lay the image over the page', () => {
    assert.equal(
      allowedImageStyle('position:fixed;inset:0;width:100vw;height:100vh;z-index:9999'),
      null,
    );
    assert.equal(allowedImageStyle('position: absolute; top: 0; left: 0; opacity: 0'), null);
  });

  it('keeps only the sizing next to a hostile declaration', () => {
    assert.equal(
      allowedImageStyle('position:fixed;inset:0;width:320px;height:100vh;z-index:9999'),
      'width: 320px',
    );
  });

  it('keeps a width and max-width', () => {
    assert.equal(
      allowedImageStyle('width: 320px; max-width: 100%'),
      'width: 320px; max-width: 100%',
    );
    assert.equal(allowedImageStyle('max-width:50%'), 'max-width: 50%');
    assert.equal(allowedImageStyle('WIDTH: AUTO;'), 'width: auto');
  });

  it('rejects sizing values that are not a plain length', () => {
    assert.equal(allowedImageStyle('width: 100vw'), null);
    assert.equal(allowedImageStyle('width: calc(100vw + 1px)'), null);
    assert.equal(allowedImageStyle('width: 320px !important'), null);
    assert.equal(allowedImageStyle('max-width: 500%'), null);
    assert.equal(allowedImageStyle('width: 99999px'), null);
    assert.equal(allowedImageStyle('width: expression(alert(1))'), null);
  });

  it('does not throw on malformed style text', () => {
    for (const css of ['', ';;;', 'width', ':', 'width:', ':320px', 'a:b:c;;width::1']) {
      assert.equal(allowedImageStyle(css), null, JSON.stringify(css));
    }
    assert.equal(allowedImageStyle(null), null);
    assert.equal(allowedImageStyle(undefined), null);
  });
});
