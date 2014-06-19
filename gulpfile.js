var gulp = require('gulp'),
  release = require('github-release'),
  pkg = require('./package.json'),
  browserify = require('browserify'),
  source = require('vinyl-source-stream'),
  rename = require('gulp-rename');

gulp.task('dist', function(){
  browserify({entries: ['./bin/mongoscope-browser.js']})
    .bundle({})
    .pipe(source('./bin/mongoscope-browser.js'))
    .pipe(rename('mongoscope.js'))
    .pipe(gulp.dest('./dist/'))
    .on('end', function(){
      gulp.src('./dist/*').pipe(release(pkg));
    });
});
