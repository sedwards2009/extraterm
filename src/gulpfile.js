var gulp = require('gulp');
var typescript = require('gulp-tsc');

gulp.task('typescript', function() {
  gulp.src('**/*.ts')
    .pipe(typescript({
      // Generates corresponding .map file.
      sourceMap : true,
      outDir: 'build_js/',

      // Do not emit comments to output.
      removeComments : false,

      // Warn on expressions and declarations with an implied 'any' type.
      noImplicitAny : false,

      // Specify module code generation: 'commonjs' or 'amd'  
      module : 'amd',

      // Specify ECMAScript target version: 'ES3' (default), or 'ES5'
      target : 'ES5',

      tmpDir: 'tmp',
      emitError: false
    }))
    .pipe(gulp.dest('build_js/'));
});

gulp.task('watch', function() {
  gulp.watch('**/*.ts', ['typescript']);
});
