/**
 * Shadow DOM rem isolation: `rem` always resolves against the document <html>
 * font-size, even inside a shadow root. Host pages that set html { font-size: 10px }
 * (common with CSS frameworks) shrink SDK text that uses rem (inputs, labels, etc.).
 *
 * Rewrites `Nrem` to fixed `px` values based on the widget's 14px base so sizing is
 * independent of the host page root font-size.
 */
const REM_BASE_PX = 14;
const REM_PATTERN = /(-?\d*\.?\d+)rem/g;

function remToPx(num) {
  const value = parseFloat(num) * REM_BASE_PX;
  return Number.isInteger(value) ? `${value}px` : `${value}px`;
}

function transformRemValue(value) {
  if (!value.includes('rem')) {
    return value;
  }

  return value.replace(REM_PATTERN, (_, num) => remToPx(num));
}

function postcssRemIsolation() {
  return {
    postcssPlugin: 'postcss-rem-isolation',
    Declaration(decl) {
      if (decl.value.includes('rem')) {
        decl.value = transformRemValue(decl.value);
      }
    },
  };
}

postcssRemIsolation.postcss = true;

export default postcssRemIsolation;
