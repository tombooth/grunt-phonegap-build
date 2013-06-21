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

function start(taskRefs, callback) {

   wrapNeedle(taskRefs.options);

   if (taskRefs.options.keys) {
      getKeys(taskRefs, doUpload.bind(null, taskRefs, callback));
   } else {
      doUpload(taskRefs, callback);
   }

}

function getKeys(taskRefs, callback) {

   taskRefs.grunt.log.ok("Getting keys for app");

   needle.get('https://build.phonegap.com/api/v1/apps/' + taskRefs.options.appId, null,
         function(error, response, body) {
            var keys = JSON.parse(body).keys,
                platformsUnlockable = Object.keys(taskRefs.options.keys),
                numUnlockable = platformsUnlockable.length;

            function unlocked() { if (--numUnlockable === 0) callback(); }

            platformsUnlockable.forEach(function(platform) {
               var buildInfo = keys[platform];
               if (buildInfo) {
                  taskRefs.grunt.log.ok("Unlocking " + platform);
                  needle.put('https://build.phonegap.com' + keys[platform].link, { data: taskRefs.options.keys[platform] }, null, unlocked);
               } else {
                  taskRefs.grunt.log.warn("No key attached to app for " + platform);
                  unlocked();
               }
            });
         });

}

function doUpload(taskRefs, callback) {

  var config = { },
      data;

  if (taskRefs.options.isRepository) {
    data = { data: { pull: true } };
  } else {
    data = { file: { file: taskRefs.options.archive, content_type: "application/zip" }};
    config.multipart = true;
  }

  taskRefs.grunt.log.ok("Starting upload");

  needle.put('https://build.phonegap.com/api/v1/apps/' + taskRefs.options.appId, data, config, callback);

}

function downloadApps(taskRefs, callback) {

   var platformsToDownload = Object.keys(taskRefs.options.download),
       num = platformsToDownload.length,
       timeoutId;

   function ready(platform, status, url) {
      platformsToDownload.splice(platformsToDownload.indexOf(platform), 1);
      if (status === 'complete') {
         taskRefs.grunt.log.ok("Downloading " + platform + " app from " + url);
         needle.get('https://build.phonegap.com' + url, null,
               function(err, response, data) {
                  if (err) {
                     taskRefs.grunt.log.error("Failed to get download location for " + platform);
                     if (--num === 0) { clearTimeout(timeoutId); callback(); }
                  } else {
                     needle._get(data.location, null, 
                        function(err, response, data) {
                           taskRefs.grunt.log.ok("Downloaded " + platform + " app");
                           require('fs').writeFile(taskRefs.options.download[platform], data, function() {
                              taskRefs.grunt.log.ok("Written " + platform + " app");
                              if (--num === 0) { clearTimeout(timeoutId); callback(); }
                           });
                        });
                  }
               });
      } else {
         taskRefs.grunt.log.error('Failed to download ' + platform + ': ' + status);
         if (--num === 0) { clearTimeout(timeoutId); callback(); }
      }
   }

   function check() {
      taskRefs.grunt.log.ok("Checking build status");
      needle.get('https://build.phonegap.com/api/v1/apps/' + taskRefs.options.appId, null,
            function(err, response, data) {
               var data = JSON.parse(data);

               platformsToDownload.forEach(function(platform) {
                  if (data.status[platform] !== 'pending') {
                     ready(platform, data.status[platform], data.download[platform]);
                  }
               });

               timeoutId = setTimeout(check, taskRefs.options.pollRate);
            });
   }

   check();

}

function responseHandler(name, taskRefs, success) {
   return function(err, resp, body) {
      if(!err && resp.statusCode == 200) {
         taskRefs.grunt.log.ok(name + " successful");
         success();
      } else if (err) {
         taskRefs.grunt.log.fail(name + " failed:");
         taskRefs.grunt.log.error("Message: " + err);
         taskRefs.done(new Error(err));
      } else {
         taskRefs.grunt.log.fail(name + " failed (HTTP " + resp.statusCode + ")");
         taskRefs.grunt.log.error("Message: " + body.error);
         taskRefs.done(new Error(body.error));
      }
   }
}

module.exports = function(grunt) {
  grunt.registerMultiTask("phonegap-build", "Creates a ZIP archive and uploads it to build.phonegap.com to create a new build", function(args) {
    var opts = this.options({
      timeout: 60000,
      pollRate: 15000
    });

    if(!grunt.file.exists(opts.archive)) {
      grunt.log.fail("Archive at " + opts.archive + " does not exist! Forgot to run 'zip' task before? Did 'zip' succeed?");
      return false;
    }

    var done = this.async(),
        taskRefs = { grunt: grunt, options: opts, done: done },
        report = responseHandler("Upload", taskRefs, done);

    if (!opts.user.password && !opts.user.token) {
      read({ prompt: 'Password: ', silent: true }, function(er, password) {
        opts.user.password = password;
        start(taskRefs, report);
      });
    } else {
      start(taskRefs, report);
    }

  });
}
