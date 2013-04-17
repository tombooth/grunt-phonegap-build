var needle = require("needle");

var doUpload = function(grunt, options, onResult) {
    needle.put('https://build.phonegap.com/api/v1/apps/' + options.appId, {
        file: { file: options.archive, content_type: "application/zip" }
      }, {
        username: options.user.email,
        password: options.user.password,
        multipart: true
      },
      onResult
    );

}

module.exports = function(grunt) {
  grunt.registerMultiTask("phonegap-build", "Creates a ZIP archive and uploads it to build.phonegap.com to create a new build", function(args) {
    var opts = this.options();
    if(!grunt.file.exists(opts.archive)) {
      grunt.log.fail("Archive at " + opts.archive + " does not exist! Forgot to run 'zip' task before? Did 'zip' succeed?");
      return false;
    }

    var done = this.async();
    doUpload(grunt, opts, function(err, resp, body) {
      if(!err && resp.statusCode == 200) {
        grunt.log.ok("Upload successful");
        done();
      } else {
        grunt.log.fail("Upload failed (HTTP " + resp.statusCode + ")");
        grunt.log.error("Message: " + body.error);
        done();
        return false;
      }
    });

  });
}