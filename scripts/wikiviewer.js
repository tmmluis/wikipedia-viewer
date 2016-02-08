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
  app.controller('SearchController', [ '$scope', '$http', '$sce', function ($scope, $http, $sce) {
    // Initialization
    $scope.articles = [];
    $scope.keyword = '';

    // Triggered when 'search' is pressed.
    $scope.search = function(keyword) {
      // Reset previous results.
      $scope.articles = [];

      /*
      * Building the search query URL.
      * To avoid cross-domain restrictions we'll be using the 'jsonp'
      * method with 'callback=JSON_CALLBACK'.
      */
      var query = 'https://en.wikipedia.org/w/api.php?'
        +'action=query&list=search&srsearch='
        + keyword
        + '&format=json&callback=JSON_CALLBACK';
      $scope.searchQueryUrl = query;

      // Perform the JSON request, parse the result, and chain a second
      // request to get more info about the returned pages.
      $http.jsonp(query)
        .then(function(response){
          return parseSearchByKeyword(response);
      })
        .then(function(response){
          parseInfo(response);
      })
        .catch(function(error){
          $scope.error = "An error has occured!";
          console.log(error);
      });
    };

    $scope.randomArticle = function(){
      // Reset previous results.
      $scope.articles = [];

      var query = 'https://en.wikipedia.org/w/api.php?'
        + 'action=query&list=random&rnnamespace=0'
        + '&format=json&callback=JSON_CALLBACK';
      $scope.searchQueryUrl = query;

      $http.jsonp(query)
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

    function parseSearchByKeyword(response){
      var searchResults = response.data.query.search;
      var titles = "";

      // Processing the results.
      for (var i = 0; i < searchResults.length; i++) {
        var article = {
          title: searchResults[i].title,
          snippet: $sce.trustAsHtml(searchResults[i].snippet)
        };
        $scope.articles.push(article);

        titles += searchResults[i].title;
        if (i < searchResults.length - 1) {
          titles += "|";
        }
      }

      /* Building info query URL. This will provide us more
      * information about each article.
      */
      var infoQuery = 'https://en.wikipedia.org/w/api.php?'
        + 'action=query&prop=info&inprop=url&titles='
        + titles
        + '&format=json&callback=JSON_CALLBACK';
      $scope.infoQuery = infoQuery;
      return $http.jsonp(infoQuery);
    }

    function parseInfo(response){
      var infoResults = response.data.query.pages;
      var ids = "";

      for (article in infoResults) {
        for (var j = 0; j < $scope.articles.length; j++) {
          if (infoResults[article].title === $scope.articles[j].title) {
            $scope.articles[j].url = infoResults[article].fullurl;
            $scope.articles[j].pageid = infoResults[article].pageid;
            break;
          }
        }
      }
    }

  }]);
})();
