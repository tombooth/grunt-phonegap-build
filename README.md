# grunt-phonegap-build
This is a grunt-task to upload a ZIP archive to [build.phonegap.com](http://build.phonegap.com) and trigger a new build.

##Configuration
First of all, you need a ZIP file, containing the contents of the PhoneGap app to be built. This can be created using [grunt-zipstream](https://github.com/Two-Screen/grunt-zipstream) for example.
The ZIP file should have the "index.html" and the ["Config.xml"](http://build.phonegap.com/docs/config-xml) in the root level and all required resources below, for example:

    ├── Config.xml
    ├── css
    │   ├── app.css
    │   ├── foundation.min.css
    │   ├── lungo.css
    │   ├── lungo.icon.brand.css
    │   ├── lungo.icon.css
    │   └── theme.lungo.css
    ├── icon.png
    ├── js
    │   ├── app.js
    │   ├── controller.js
    │   ├── directives.js
    │   ├── filters.js
    │   ├── services.js
    ├── images
    │   └── background.jpg
    ├── index.html

Then, some configuration for phonegap-build is needed:

 1. ```archive```: The path (or filename, if it's in the same directory as the Gruntfile) to the ZIP archive
 2. ```appId```: The App ID of the application on build.phonegap.com (see details of your app there to get it)
 3. ```user```: The email and password you log in with on build.phonegap.com

That's all. Once you configured the build-phonegap, you can run

    $ grunt phonegap-build
or if you have a "zip" target to create the archive before:

    $ grunt zip phonegap-build

to create a new build.
**Note:** This is a multitask, so you can specify different configurations for it (e.g. test and production). You need to specify at least one configuration
Here is an example for a Gruntfile.js:

    module.exports = function(grunt) {

      // Project configuration.
      grunt.initConfig({
        "phonegap-build": {
          debug: {
            options: {
              archive: "app.zip",
              "appId": "1234",
              "user": {
                "email": "your.email@example.org",
                "password": "yourPassw0rd"
              }
            }
          },
          release: {
            options: {
              archive: "app.zip",
              "appId": "9876",
              "user": {
                "email": "your.email@company.com",
                "password": "yourSeriousPassw0rd123"
              }
            }
          }
        },
        zip: {
          app: {
            file: {
              src: ["index.html", "js/**/*.js", "css/**/*.js", "icon.png", "images/background.jpg"],
              dest: "app.zip"
            }
         }
        }
      });

      // Load tasks.
      grunt.loadNpmTasks('grunt-zipstream');
      grunt.loadNpmTasks('grunt-phonegap-build');

      // Default task.
      grunt.registerTask('default', 'zip phonegap-build:debug');
    };
This example also aliased

    $ grunt
to run "zip" and then "phonegap-build" for you.