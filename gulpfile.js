var gulp = require('gulp'),
  release = require('github-release'),
  pkg = require('./package.json'),
  browserify = require('browserify'),
  source = require('vinyl-source-stream'),
  rename = require('gulp-rename'),
  ecstatic = require('ecstatic'),
  http = require('http'),
  exec = require('child_process').exec;


function create(fn){
  browserify({entries: ['./bin/mongoscope-browser.js']})
    .bundle({})
    .pipe(source('./bin/mongoscope-browser.js'))
    .pipe(rename('mongoscope.js'))
    .pipe(gulp.dest('./dist/'))
    .on('end', fn);
}

gulp.task('serve', function(){
  create(function(){
    gulp.src('./dist/mongoscope.js')
      .pipe(gulp.dest('./examples/'));

    http.createServer(
      ecstatic({root: __dirname + '/'})
    ).listen(8080);
    exec('open http://localhost:8080/examples', function(){});
  });
});

gulp.task('dist', function(){
  create(function(){
    gulp.src('./dist/*').pipe(release(pkg));
  });
});
