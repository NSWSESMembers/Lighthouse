'use strict';

// CAVEATS/TODO
// - Currently `watch` only supports JS and CSS compiled by browserify
// - There is redundancy in how we compile/minify CSS and HTML
// - Our JS is really big because no libs are externalised (and
//   therefore shared)
// - jshint/`lint` probably does not work with JSX (easy fix)

var gulp = require('gulp'),
  clean = require('gulp-clean'),
  cleanhtml = require('gulp-cleanhtml'),
  jshint = require('gulp-jshint'),
  uglify = require('gulp-uglify'),
  zip = require('gulp-zip'),
  foreach = require('gulp-foreach'),
  size = require('gulp-size'),
  path = require('path'),
  browserify = require('browserify'),
  watchify = require('watchify'),
  streamify = require('gulp-streamify'),
  gutil = require('gulp-util'),
  rename = require('gulp-rename'),
  buffer = require('vinyl-buffer'),
  sourcemaps = require('gulp-sourcemaps'),
  concatCss = require('gulp-concat-css'),
  source = require('vinyl-source-stream'),
  jsxify = require('jsx-transform').browserifyTransform,
  fse = require('fs-extra'),
  _ = require('underscore');

const SIZE_OPTS = {
    showFiles: true,
    gzip: true
};

const BROWSERIFY_TRANSFORMS = [];
const EXTERNAL_LIBS = {
  //jquery: './node_modules/jquery/dist/jquery.min.js',
  //bootstrap: './node_modules/bootstrap/dist/js/bootstrap.min.js'
};

var use_watchify = false;

// produce a configured bundler for browserify/watchify builds
function getBundler(file, dest, options) {
  if(use_watchify) {
    options = _.extend(options || {}, watchify.args);
  }

  options = _.extend(options || {}, {
    // Enable source maps.
    debug: true,
    // Configure transforms.
    transform: BROWSERIFY_TRANSFORMS
  });

  var relativeFilename = file.path.replace(file.base, '');

  // Initialize browserify with the file and options provided.
  var bundler = browserify(file.path, options);

  if(use_watchify) {
    bundler = watchify(bundler);
  }

  // Transpile JSX
  bundler.transform(jsxify, {factory: 'DOM'});

  // setup CSS
  bundler.transform('browserify-css', {
    global: true,
    processRelativeUrl: function(relativeUrl) {
      var prefix = 'node_modules';
      var fsDest = 'build/pages/vendor/';
      var urlDest = 'vendor';

      var stripQueryStringAndHashFromPath = function(url) {
        return url.split('?')[0].split('#')[0];
      };
      var rootDir = process.cwd();
      var relativePath = stripQueryStringAndHashFromPath(relativeUrl);
      var queryStringAndHash = relativeUrl.substring(relativePath.length);

      if (relativePath.indexOf(prefix, 0) === 0) {
        var vendorPath = fsDest + relativePath.substring(prefix.length);
        var source = path.join(rootDir, relativePath);
        var target = path.join(rootDir, vendorPath);

        //gutil.log('Copying file from ' + JSON.stringify(source) + ' to ' + JSON.stringify(target));
        fse.copySync(source, target);

        // Returns a new path string with original query string and hash fragments 
        return urlDest + relativePath.substring(prefix.length) + queryStringAndHash;
      }

      return relativeUrl;
    }
  });

  // set up logging
  bundler
    .on('error', function(err) {
      gutil.log('Browserify error', err);
      this.emit('end');
    })
    .on('log', gutil.log)

  // bundle output steps
  function rebundle() {
    return bundler
      .bundle()
      .on('error', function(err) {
        gutil.log('Browserify bundle error', err);
        this.emit('end');
      })
      // Rename the bundled file to relativeFilename
      .pipe(source(relativeFilename))
      // Convert stream to a buffer
      .pipe(buffer())
      // save sourcemaps
      .pipe(sourcemaps.init({loadMaps: true}))
      //.pipe(uglify())
      //.on('error', gutil.log.bind(gutil, 'Uglify error'))
      .pipe(size(SIZE_OPTS))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(dest));
  }

  // Exclude externalized libs (those from build-common-lib).
  Object.keys(EXTERNAL_LIBS).forEach(function(lib) {
      bundler.external(lib);
  });

  if(use_watchify) {
    // Whenever the application or its dependencies are modified, automatically
    // rebundle the application.
    bundler.on('update', rebundle);
  }

  return rebundle();
}

// copy static folders to build directory
gulp.task('copy', function() {
  gulp.src('src/fonts/**')
    .pipe(gulp.dest('build/fonts'));
  gulp.src('src/icons/**')
    .pipe(gulp.dest('build/icons'));
  gulp.src('src/_locales/**')
    .pipe(gulp.dest('build/_locales'));
  return gulp.src('src/manifest.json')
    .pipe(gulp.dest('build'));
});

gulp.task('contentscripts', function() {
  return gulp.src('src/contentscripts/**/*.js')
    .pipe(foreach(function(stream, file) {
      return getBundler(file, 'build/contentscripts');
    }));
});

gulp.task('injectscripts', function() {
  return gulp.src('src/injectscripts/**/*.js')
    .pipe(foreach(function(stream, file) {
      return getBundler(file, 'build/injectscripts');
    }));
});

gulp.task('background', function() {
  return browserify('src/background/main.js')
    .bundle()
    .pipe(source('src/background/main.js'))
    .pipe(streamify(uglify()))
    .pipe(rename('background.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('lint', function() {
  return gulp.src(['src/**/*.js', 'pages/**/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('pages_scripts', function() {
  gulp.src('pages/vendors/**/*.js', {cwd: process.cwd()})
    .pipe(gulp.dest('build/pages/vendors'));
  return gulp.src('pages/scripts/*.js')
    .pipe(foreach(function(stream, file) {
      return getBundler(file, 'build/pages/scripts');
    }));
});

gulp.task('pages_styles', function () {
  var include_paths = [
    'pages/styles/include',
    'node_modules/bootstrap/dist/css',
    'node_modules/dc',
    'node_modules/jqcloud-npm/dist',
  ];

  return gulp.src(['pages/styles/**/*.css', '!pages/styles/include/*'])
    .pipe(foreach(function(stream, file) {
      var relativeFilename = file.path.replace(file.base, '');

      return stream.pipe(concatCss(relativeFilename, {
          includePaths: include_paths
        }))
        .on('error', gutil.log.bind(gutil, 'Concat CSS error'))
        .pipe(size(SIZE_OPTS))
        .pipe(gulp.dest('build/pages/styles'));
    }));
});

// copy and compress HTML files
gulp.task('pages_html', function() {
  return gulp.src('pages/*.html')
    .pipe(cleanhtml())
    .pipe(gulp.dest('build/pages'));
});

// copy static folders to build directory
gulp.task('pages_static', function() {
  gulp.src('pages/icons/**')
    .pipe(gulp.dest('build/pages/images'));
  return gulp.src('src/manifest.json')
    .pipe(gulp.dest('build'));
});

gulp.task('pages', ['pages_html', 'pages_scripts', 'pages_styles', 'pages_static']);

// build distributable and sourcemaps after other tasks completed
gulp.task('zip', ['contentscripts', 'injectscripts', 'background', 'copy', 'pages'], function() {
  var manifest = require('./src/manifest'),
    distFileName = manifest.name + ' v' + manifest.version + '.zip',
    mapFileName = manifest.name + ' v' + manifest.version + '-maps.zip';
  //collect all source maps
  gulp.src('build/scripts/**/*.map')
    .pipe(zip(mapFileName))
    .pipe(gulp.dest('dist'));
  //build distributable extension
  return gulp.src(['build/**', '!build/scripts/**/*.map'])
    .pipe(zip(distFileName))
    .pipe(gulp.dest('dist'));
});

// clean build directory
gulp.task('clean', function() {
  return gulp.src('build/*', {read: false})
    .pipe(clean());
});

// run all tasks after build directory has been cleaned
gulp.task('default', ['clean'], function() {
  gulp.start('zip');
});

gulp.task('watch', function() {
  // just set use_watchify to true so the builds will be watchify-enabled
  use_watchify = true;

  // now run the regular default task and print a pretty message when done
  gulp.start('default', function() {
    console.log('=====================================================');
    console.log('Watchify is now watching for changes and will rebuild');
    console.log('JS and some CSS automatically.');
    console.log('=====================================================');
  });
});
