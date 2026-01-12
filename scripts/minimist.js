// Minimist (lightweight CLI args parser) - version inline for portability
module.exports = function minimist (args) {
  var argv = {},
      arg,
      i;
  for (i = 0; i < args.length; i++) {
    arg = args[i];
    if (arg.startsWith('--')) {
      var eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        argv[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        argv[arg.slice(2)] = true;
      }
    }
  }
  return argv;
};