module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    testacular: {
      unit: {
        configFile: "testacular.conf.js"
      }
    },
  });

  // Load local tasks.
  grunt.loadNpmTasks('grunt-testacular');

  // Load local tasks.
  grunt.loadTasks('tasks');

  // Default task.
  grunt.registerTask('default', 'testacular');
  grunt.registerTask('test', 'testacular');
};
