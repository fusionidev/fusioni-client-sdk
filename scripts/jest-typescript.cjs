const typescript = require('typescript');

module.exports = {
  process(source, filename) {
    const result = typescript.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        target: typescript.ScriptTarget.ES2020,
        module: typescript.ModuleKind.CommonJS,
        jsx: typescript.JsxEmit.ReactJSX,
        esModuleInterop: true,
        sourceMap: true,
      },
    });
    return {code: result.outputText, map: result.sourceMapText};
  },
};
