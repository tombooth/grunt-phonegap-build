var needle = require("needle"),
    read = require("read");

function mapMerge(map1, map2) {
   if (map1 && map2) {
      Object.keys(map2).forEach(function(key) {
         if (map1[key] === undefined) {
            map1[key] = map2[key];
         }
      });
   }

   return map1 ? map1 : map2;
}

function wrapNeedle(options) {
   var config = {
         username: options.user.email,
         password: options.user.password,
         timeout: options.timeout    
       }, 
       query = options.user.token ? '?auth_token=' + options.user.token : '';

   Object.keys(needle).forEach(function(property) {
      var needleFn = needle[property];

      if (typeof needleFn === 'function') {
         needle[property] = function() {
            var configIndex = needleFn.length - 2,
                args = Array.prototype.slice.call(arguments);

            args[0] += query;
            args[configIndex] = mapMerge(args[configIndex], config);

            needleFn.apply(needle, args);
         }
         needle['_' + property] = needleFn;
      }

   });
}

function start(grunt, options, callback) {

   wrapNeedle(options);

   if (options.keys) {
      getKeys(grunt, options, doUpload.bind(null, grunt, options, callback));
   } else {
      doUpload(grunt, options, callback);
   }

}

function getKeys(grunt, options, callback) {

   grunt.log.ok("Getting keys for app");

   needle.get('https://build.phonegap.com/api/v1/apps/' + options.appId, null,
         function(error, response, body) {
            var keys = JSON.parse(body).keys,
                platformsUnlockable = Object.keys(options.keys),
                numUnlockable = platformsUnlockable.length;

            function unlocked() { if (--numUnlockable === 0) callback(); }

            platformsUnlockable.forEach(function(platform) {
               var buildInfo = keys[platform];
               if (buildInfo) {
                  grunt.log.ok("Unlocking " + platform);
                  needle.put('https://build.phonegap.com' + keys[platform].link, { data: options.keys[platform] }, null, unlocked);
               } else {
                  grunt.log.warn("No key attached to app for " + platform);
                  unlocked();
               }
            });
         });

}

function doUpload(grunt, options, callback) {

  var config = { },
      data;

  if (options.isRepository) {
    data = { data: { pull: true } };
  } else {
    data = { file: { file: options.archive, content_type: "application/zip" }};
    config.multipart = true;
  }

  grunt.log.ok("Starting upload");

  needle.put('https://build.phonegap.com/api/v1/apps/' + options.appId, data, config, callback);

}

function downloadApps(grunt, options, callback) {

   var platformsToDownload = Object.keys(options.download),
       num = platformsToDownload.length,
       timeoutId;

   function ready(platform, status, url) {
      platformsToDownload.splice(platformsToDownload.indexOf(platform), 1);
      if (status === 'complete') {
         grunt.log.ok("Downloading " + platform + " app from " + url);
         needle.get('https://build.phonegap.com' + url, null,
               function(err, response, data) {
                  if (err) {
                     grunt.log.error("Failed to get download location for " + platform);
                     if (--num === 0) { clearTimeout(timeoutId); callback(); }
                  } else {
                     needle._get(data.location, null, 
                        function(err, response, data) {
                           grunt.log.ok("Downloaded " + platform + " app");
                           require('fs').writeFile(options.download[platform], data, function() {
                              grunt.log.ok("Written " + platform + " app");
                              if (--num === 0) { clearTimeout(timeoutId); callback(); }
                           });
                        });
                  }
               });
      } else {
         grunt.log.error('Failed to download ' + platform + ': ' + status);
         if (--num === 0) { clearTimeout(timeoutId); callback(); }
      }
   }

   function check() {
      grunt.log.ok("Checking build status");
      needle.get('https://build.phonegap.com/api/v1/apps/' + options.appId, null,
            function(err, response, data) {
               var data = JSON.parse(data);

               platformsToDownload.forEach(function(platform) {
                  if (data.status[platform] !== 'pending') {
                     ready(platform, data.status[platform], data.download[platform]);
                  }
               });

               timeoutId = setTimeout(check, options.pollRate);
            });
   }

   check();

}

module.exports = function(grunt) {
  grunt.registerMultiTask("phonegap-build", "Creates a ZIP archive and uploads it to build.phonegap.com to create a new build", function(args) {
    var opts = this.options({
      timeout: 5000,
      pollRate: 15000
    });

    if(!grunt.file.exists(opts.archive)) {
      grunt.log.fail("Archive at " + opts.archive + " does not exist! Forgot to run 'zip' task before? Did 'zip' succeed?");
      return false;
    }

    var done = this.async(),
        report = function(err, resp, body) {
          if(!err && resp.statusCode == 200) {
            grunt.log.ok("Upload successful");
            if (opts.download) downloadApps(grunt, opts, done);
            else done();
          } else if (err) {
            grunt.log.fail("Upload failed:");
            grunt.log.error("Message: " + err);
            done();
            return false;
          } else {
            grunt.log.fail("Upload failed (HTTP " + resp.statusCode + ")");
            grunt.log.error("Message: " + body.error);
            done();
            return false;
          }
        };

    if (!opts.user.password && !opts.user.token) {
      read({ prompt: 'Password: ', silent: true }, function(er, password) {
        opts.user.password = password;
        start(grunt, opts, report);
      });
    } else {
      start(grunt, opts, report);
    }

  });
}
