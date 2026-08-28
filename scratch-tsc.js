const ts = require('typescript');
const fs = require('fs');

const files = ['src/app/admin/inventory/page.tsx', 'src/app/admin/dashboard/page.tsx'];

const program = ts.createProgram(files, {
  noEmit: true,
  jsx: ts.JsxEmit.Preserve,
  esModuleInterop: true,
  resolveJsonModule: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs
});

const emitResult = program.emit();
const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  }
});
