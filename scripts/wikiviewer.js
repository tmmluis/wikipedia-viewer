// Wrapping the Javascript in a closure (to avoid collisions with global scope).
(function () {
  // Creating the AngularJS module.
  var app = angular.module('wikipediaViewer', []);

  /*
  * Creating and registering a controller with our module.
  * Adding the '$http' service as a dependency so we can get
  * JSON from Wikipedia api.
  * Adding the'$sce' service so we can explicitly trust html returned
  * from Wikipedia and use 'ng-bind-html'.
  */
  app.controller('SearchController', [ '$scope', '$http', '$sce', '$q',
      function ($scope, $http, $sce, $q) {
    // Initialization
    $scope.articles = [];
    $scope.keyword = '';
    var ENDPOINT = 'https://en.wikipedia.org/w/api.php?';

    // Triggered when 'search' is pressed.
    $scope.search = function(keyword) {
      // Reset previous results.
      $scope.articles = [];

      /*
      * Building the search query URL.
      * To avoid cross-domain restrictions we'll be using the 'jsonp'
      * method with 'callback=JSON_CALLBACK'.
      */
      var query = 'action=query&list=search&srsearch=';
      var parameters = '&format=json&callback=JSON_CALLBACK';

      var url = ENDPOINT + query + keyword + parameters;

      // Perform the JSON request, parse the result, and chain a second
      // request to get more info about the returned pages.
      Wikipedia.search(url).then(function(infoURL) {
        Wikipedia.getInfo(infoURL).then(function(info) {
          parseInfo(info);
        });
      })
        .catch(function(error){
          console.log("There was an error querying Wikipedia: " + error);
      });
    };

    $scope.randomArticle = function(){
      // Reset previous results.
      $scope.articles = [];

      var query = 'action=query&list=random&rnnamespace=0';
      var parameters = '&format=json&callback=JSON_CALLBACK';

      var url = ENDPOINT + query + parameters;

      $http.jsonp(url)
        .then(function(response){
          var page = response.data.query.random[0];
          var article = {
            pageid: page.id,
            title: page.title
          };
          query = 'https://en.wikipedia.org/w/api.php?'
            + 'action=query&prop=extracts|info&format=json&explaintext=&exchars=300&inprop=url&pageids='
            + article.pageid
            + '&callback=JSON_CALLBACK';
          $scope.articles.push(article);
          return $http.jsonp(query);
        })
        .then(function(response){
          var article =  $scope.articles[0];
          var page = response.data.query.pages[article.pageid];
          article.snippet = $sce.trustAsHtml('<p>' + page.extract + '</p>');
          article.url = page.fullurl;
        })
        .catch(function(error){
          $scope.error = "An error has occured!";
          console.log(error);
      });
    };

    /*  Parses an Array of search results and builds the 'articles' object.
    *   returns the url request necessary to get additional info for each
    *   of the pages.
    */
    function parseSearch(searchResults){
      var titles = '';
      for (var i = 0; i < searchResults.length; i++) {
        $scope.articles.push({
          title: searchResults[i].title,
          snippet: $sce.trustAsHtml(searchResults[i].snippet + ' (...)')
        });
        titles += searchResults[i].title;
        if (i < searchResults.length - 1) {
          titles += "|";
        }
      }
      /* Building info query URL. This will provide us more
      * information about each article.
      */
      var query = 'action=query&prop=info&inprop=url&titles=';
      var parameters = '&format=json&callback=JSON_CALLBACK';
      return ENDPOINT + query + titles + parameters;
    }

    /*
    *   Parses an Array of pages (obtained from querying Wikipedia for info)
    *   and updates the 'articles' object with that data.
    */
    function parseInfo(pages) {
      for (article in pages) {
        for (var j = 0; j < $scope.articles.length; j++) {
          if (pages[article].title === $scope.articles[j].title) {
            $scope.articles[j].url = pages[article].fullurl;
            $scope.articles[j].pageid = pages[article].pageid;
            break;
          }
        }
      }
    }

    var Wikipedia = {
      search: function(request) {
        var deferred = $q.defer();
        $http.jsonp(request).then(function(response) {
          var results = response.data.query.search;
          var infoURL = parseSearch(results);
          deferred.resolve(infoURL);
        });
        return deferred.promise;
      },
      getInfo: function(request) {
        var deferred = $q.defer();
        $http.jsonp(request).then(function(response) {
          deferred.resolve(response.data.query.pages);
        });
        return deferred.promise;
      }
    }

  }]);
})();
