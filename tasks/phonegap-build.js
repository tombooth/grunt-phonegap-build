var needle = require("needle"),
    read = require("read");

var doUpload = function(grunt, options, onResult) {
  if(options.isRepository) { //This is a repository-backed app
    var query = options.user.token ? '?auth_token=' + options.user.token : '';    
    needle.put('https://build.phonegap.com/api/v1/apps/' + options.appId + query, {
      data: {pull: true}
    }, {
      username: options.user.email,
      password: options.user.password,
      timeout: options.timeout    
    },
      onResult
    );    
  
  }
  else { //Oh, a file-based app
    var query = options.user.token ? '?auth_token=' + options.user.token : '';    
    needle.put('https://build.phonegap.com/api/v1/apps/' + options.appId + query, {
      file: { file: options.archive, content_type: "application/zip" }
    }, {
      username: options.user.email,
      password: options.user.password,
      timeout: options.timeout,
      multipart: true
    },
      onResult
    );    
  }
}

module.exports = function(grunt) {
  grunt.registerMultiTask("phonegap-build", "Creates a ZIP archive and uploads it to build.phonegap.com to create a new build", function(args) {
    var opts = this.options({
      timeout: 60000
    });

    if(!grunt.file.exists(opts.archive)) {
      grunt.log.fail("Archive at " + opts.archive + " does not exist! Forgot to run 'zip' task before? Did 'zip' succeed?");
      return false;
    }

    var done = this.async(),
        report = function(err, resp, body) {
          if(!err && resp.statusCode == 200) {
            grunt.log.ok("Upload successful");
            done();
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
        doUpload(grunt, opts, report);
      });
    } else {
      doUpload(grunt, opts, report);
    }

  });
}