// Wrapping the Javascript in a closure (to avoid collisions with global scope).
(function () {
  // Creating the AngularJS module.
  var app = angular.module('wikipediaViewer', []);

  /*
  * The app controller and its dependencies:
  *   '$http' to request JSON from the server.
  *   '$sce' to bind returned HTML content via 'ng-bind-html'.
  *   '$q' to intercept the asynchronous requests.
  */
  app.controller('SearchController', [ '$scope', '$http', '$sce', '$q',
      function ($scope, $http, $sce, $q) {

    $scope.search = function(keyword) {
      Wikipedia.search(keyword).then(function(articles) {
        $scope.articles = articles;
      }).catch(function(error){
        console.log("There was an error querying Wikipedia: " + error);
      });
    };

    $scope.randomArticle = function() {
      Wikipedia.randomArticle().then(function(article) {
        $scope.articles = article;
      }).catch(function(error){
        console.log("There was an error querying Wikipedia: " + error);
      });
    };

    var Wikipedia = {
      /*
      * Building the Wikimedia API request URL.
      * To avoid cross-domain restrictions we'll be using the 'jsonp'
      * method with 'callback=JSON_CALLBACK'.
      */
      buildRequestURL: function(action, criteria) {
        var endpoint = 'https://en.wikipedia.org/w/api.php?';
        var parameters = '';
        var criteria = criteria || '';
        var format = '&format=json&callback=JSON_CALLBACK';

        switch(action) {
          case 'search':
            parameters = 'action=query&list=search&srsearch=';
            break;
          case 'infoFromTitles':
            parameters = 'action=query&prop=info&inprop=url&titles=';
            break;
          case 'random':
            parameters = 'action=query&list=random&rnnamespace=0';
            break;
          case 'infoFromId':
            parameters = 'action=query&prop=extracts|info&explaintext=&exchars=300&inprop=url&pageids=';
            break;
        }
        var query = parameters + criteria;
        return endpoint + query + format;
      },
      // Returns an Array of Wikipedia articles matching to the keyword.
      search: function(keyword) {
        var url = Wikipedia.buildRequestURL('search', keyword);
        var deferred = $q.defer();
        var articles = [];

        $http.jsonp(url).then(function(response) {
          articles = response.data.query.search;
          var titles = '';

          for (var i = 0; i < articles.length; i++) {
            // Parse the article snippet as trusted HTML so it can display properly.
            articles[i].snippet = $sce.trustAsHtml(articles[i].snippet + ' (...)');
            // Concatenate all article titles into one String object.
            titles += articles[i].title;
            if (i < articles.length - 1) {
              titles += "|";
            }
          }
          var infoURL = Wikipedia.buildRequestURL('infoFromTitles', titles);
          // Query Wikipedia for additional information on the provided titles.
          // This will provide us URL's for each article.
          $http.jsonp(infoURL).then(function(response) {
            var pages = response.data.query.pages;
            for (page in pages) {
              for (var i = 0; i < articles.length; i++) {
                if (pages[page].title === articles[i].title) {
                  articles[i].url = pages[page].fullurl;
                  articles[i].id = pages[page].pageid;
                  break;
                }
              }
            }
            deferred.resolve(articles);
          });
        });
        return deferred.promise;
      },
      /*
      *   Processes a request to Wikipedia for a random page and returns an
      *   Array with a single 'article' object.
      */
      randomArticle: function(request) {
        var url = Wikipedia.buildRequestURL('random');
        var deferred = $q.defer();

        $http.jsonp(url).then(function(response) {
          var article = response.data.query.random[0];
          var infoURL = Wikipedia.buildRequestURL('infoFromId', article.id);

          $http.jsonp(infoURL).then(function(response) {
            var articleInfo = response.data.query.pages[article.id];
            var output = [];

            article.snippet = $sce.trustAsHtml('<p>' + articleInfo.extract + '</p>');
            article.url = articleInfo.fullurl;

            output.push(article);
            deferred.resolve(output);
          });
        });
        return deferred.promise;
      }
    }

  }]);
})();
