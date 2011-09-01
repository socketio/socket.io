
    

  

<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <meta http-equiv="X-UA-Compatible" content="chrome=1">
    <script type="text/javascript">var NREUMQ=[];NREUMQ.push(["mark","firstbyte",new Date().getTime()]);</script>
        <title>lib/transports/websocket/default.js at master from LearnBoost/socket.io - GitHub</title>
    <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="GitHub" />
    <link rel="fluid-icon" href="https://github.com/fluidicon.png" title="GitHub" />

    
    

    <meta content="authenticity_token" name="csrf-param" />
<meta content="91770a44bec472e58cf4f4f381f26d7f69e2c37d" name="csrf-token" />

    <link href="https://a248.e.akamai.net/assets.github.com/stylesheets/bundle_github.css?8c5571ecf8077fea4f0d3631501efeabf0752526" media="screen" rel="stylesheet" type="text/css" />
    

    <script src="https://a248.e.akamai.net/assets.github.com/javascripts/jquery/jquery-1.6.1.min.js" type="text/javascript"></script>
    <script src="https://a248.e.akamai.net/assets.github.com/javascripts/bundle_github.js?fde176b643d78d7abd700d85536632b2b9353c75" type="text/javascript"></script>

    

    
  <link rel='permalink' href='/LearnBoost/socket.io/blob/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40/lib/transports/websocket/default.js'>

  <link href="https://github.com/LearnBoost/socket.io/commits/master.atom" rel="alternate" title="Recent Commits to socket.io:master" type="application/atom+xml" />

    

    <meta name="description" content="socket.io - Sockets for the rest of us (in Node.js)" />
  

        <script type="text/javascript">
      var _gaq = _gaq || [];
      _gaq.push(['_setAccount', 'UA-3769691-2']);
      _gaq.push(['_setDomainName', 'none']);
      _gaq.push(['_trackPageview']);
      _gaq.push(['_trackPageLoadTime']);
      (function() {
        var ga = document.createElement('script');
        ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
        ga.setAttribute('async', 'true');
        document.documentElement.firstChild.appendChild(ga);
      })();
    </script>

  </head>

  

  <body class="logged_in page-blob  env-production">
    

    

    

    <div class="subnavd" id="main">
      <div id="header" class="true">
          <a class="logo boring" href="https://github.com/">
            
            <img alt="github" class="default" height="45" src="https://a248.e.akamai.net/assets.github.com/images/modules/header/logov6.png" />
            <!--[if (gt IE 8)|!(IE)]><!-->
            <img alt="github" class="hover" height="45" src="https://a248.e.akamai.net/assets.github.com/images/modules/header/logov6-hover.png" />
            <!--<![endif]-->
          </a>

        
          





  
    <div class="userbox">
      <div class="avatarname">
        <a href="https://github.com/dshaw"><img src="https://secure.gravatar.com/avatar/dc2beefe13f65e75fd74eae1b1c1b803?s=140&d=https://a248.e.akamai.net/assets.github.com%2Fimages%2Fgravatars%2Fgravatar-140.png" alt="" width="20" height="20"  /></a>
        <a href="https://github.com/dshaw" class="name">dshaw</a>

        
        
          <a href="https://github.com/inbox/notifications" class="unread_count notifications_count new tooltipped downwards js-notification-count" title="Unread Notifications">413</a>
        
      </div>
      <ul class="usernav">
        <li><a href="https://github.com/">Dashboard</a></li>
        <li>
          
          <a href="https://github.com/inbox">Inbox</a>
          <a href="https://github.com/inbox" class="unread_count ">0</a>
        </li>
        <li><a href="https://github.com/account">Account Settings</a></li>
        <li><a href="/logout">Log Out</a></li>
      </ul>
    </div><!-- /.userbox -->
  


        
        <div class="topsearch">
  
    <form action="/search" id="top_search_form" method="get">
      <a href="/search" class="advanced-search tooltipped downwards" title="Advanced Search">Advanced Search</a>
      <div class="search placeholder-field js-placeholder-field">
        <label class="placeholder" for="global-search-field">Search…</label>
        <input type="text" class="search my_repos_autocompleter" id="global-search-field" name="q" results="5" /> <input type="submit" value="Search" class="button" />
      </div>
      <input type="hidden" name="type" value="Everything" />
      <input type="hidden" name="repo" value="" />
      <input type="hidden" name="langOverride" value="" />
      <input type="hidden" name="start_value" value="1" />
    </form>
    <ul class="nav">
      <li><a href="/explore">Explore GitHub</a></li>
      <li><a href="https://gist.github.com">Gist</a></li>
      
      <li><a href="/blog">Blog</a></li>
      
      <li><a href="http://help.github.com">Help</a></li>
    </ul>
  
</div>

      </div>

      
      
        
    <div class="site">
      <div class="pagehead repohead vis-public    instapaper_ignore readability-menu">

      

      <div class="title-actions-bar">
        <h1>
          <a href="/LearnBoost">LearnBoost</a> /
          <strong><a href="/LearnBoost/socket.io" class="js-current-repository">socket.io</a></strong>
          
          
        </h1>

        
    <ul class="actions">
      

      
        
        <li>
          
            <a href="/LearnBoost/socket.io/toggle_watch" class="minibutton btn-watch unwatch-button" onclick="var f = document.createElement('form'); f.style.display = 'none'; this.parentNode.appendChild(f); f.method = 'POST'; f.action = this.href;var s = document.createElement('input'); s.setAttribute('type', 'hidden'); s.setAttribute('name', 'authenticity_token'); s.setAttribute('value', '91770a44bec472e58cf4f4f381f26d7f69e2c37d'); f.appendChild(s);f.submit();return false;"><span><span class="icon"></span>Unwatch</span></a>
          
        </li>
        
          
            
              <li><a href="/dshaw/socket.io" class="minibutton btn-fork "><span><span class="icon"></span>Your Fork</span></a></li>
            

            <div id="fork_box" style="display:none">
              <h2>Where do you want to fork this to?</h2>
              
                <p>Already forked to dshaw!  <a href="/dshaw/socket.io">Go to the fork</a></p>
              
              
                <div class="rule"></div>
                
                  <div class="full-button">
                    <form action="/LearnBoost/socket.io/fork" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
                      <input id="organization" name="organization" type="hidden" value="nko" />
                      <button class="classy"><span>Fork to nko (organization)</span></button>
                    </form>
                  </div>
                
              
                <div class="rule"></div>
                
                  <div class="full-button">
                    <form action="/LearnBoost/socket.io/fork" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
                      <input id="organization" name="organization" type="hidden" value="dreadnode" />
                      <button class="classy"><span>Fork to dreadnode (organization)</span></button>
                    </form>
                  </div>
                
              
                <div class="rule"></div>
                
                  <div class="full-button">
                    <form action="/LearnBoost/socket.io/fork" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
                      <input id="organization" name="organization" type="hidden" value="mediadesign" />
                      <button class="classy"><span>Fork to mediadesign (organization)</span></button>
                    </form>
                  </div>
                
              
                <div class="rule"></div>
                
                  <div class="full-button">
                    <form action="/LearnBoost/socket.io/fork" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
                      <input id="organization" name="organization" type="hidden" value="huddlejam" />
                      <button class="classy"><span>Fork to huddlejam (organization)</span></button>
                    </form>
                  </div>
                
              
                <div class="rule"></div>
                
                  <p>You don't have permission to create new repositories for nko2</p>
                
              
                <div class="rule"></div>
                
                  <p>You don't have permission to create new repositories for geeklist</p>
                
              
            </div>
          

          
        
      
      
      <li class="repostats">
        <ul class="repo-stats">
          <li class="watchers watching">
            <a href="/LearnBoost/socket.io/watchers" title="Watchers — You're Watching" class="tooltipped downwards">
              2,377
            </a>
          </li>
          <li class="forks">
            <a href="/LearnBoost/socket.io/network" title="Forks - You have a fork" class="tooltipped downwards">
              265
            </a>
          </li>
        </ul>
      </li>
    </ul>

      </div>

        
  <ul class="tabs">
    <li><a href="/LearnBoost/socket.io" class="selected" highlight="repo_source">Source</a></li>
    <li><a href="/LearnBoost/socket.io/commits/master" highlight="repo_commits">Commits</a></li>
    <li><a href="/LearnBoost/socket.io/network" highlight="repo_network">Network</a></li>
    <li><a href="/LearnBoost/socket.io/pulls" highlight="repo_pulls">Pull Requests (7)</a></li>

    

    
      
      <li><a href="/LearnBoost/socket.io/issues" highlight="issues">Issues (76)</a></li>
    

                <li><a href="/LearnBoost/socket.io/wiki" highlight="repo_wiki">Wiki (11)</a></li>
        
    <li><a href="/LearnBoost/socket.io/graphs" highlight="repo_graphs">Graphs</a></li>

    

    <li class="contextswitch nochoices">
      <span class="repo-tree toggle leftwards"
            
            data-master-branch="master"
            data-ref="master">
        <em>Branch:</em>
        <code>master</code>
      </span>
    </li>
  </ul>

  <div style="display:none" id="pl-description"><p><em class="placeholder">click here to add a description</em></p></div>
  <div style="display:none" id="pl-homepage"><p><em class="placeholder">click here to add a homepage</em></p></div>

  <div class="subnav-bar">
  
  <ul>
    <li>
      <a href="/LearnBoost/socket.io/branches" class="dropdown">Switch Branches (4)</a>
      <ul>
        
          
          
            <li><a href="/LearnBoost/socket.io/blob/06/lib/transports/websocket/default.js">06</a></li>
          
        
          
          
            <li><a href="/LearnBoost/socket.io/blob/develop/lib/transports/websocket/default.js">develop</a></li>
          
        
          
          
            <li><a href="/LearnBoost/socket.io/blob/gh-pages/lib/transports/websocket/default.js">gh-pages</a></li>
          
        
          
            <li><strong>master &#x2713;</strong></li>
            
      </ul>
    </li>
    <li>
      <a href="#" class="dropdown ">Switch Tags (55)</a>
              <ul>
                      
              <li><a href="/LearnBoost/socket.io/blob/0.8.2/lib/transports/websocket/default.js">0.8.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.8.1/lib/transports/websocket/default.js">0.8.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.8.0/lib/transports/websocket/default.js">0.8.0</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.11/lib/transports/websocket/default.js">0.7.11</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.10/lib/transports/websocket/default.js">0.7.10</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.9/lib/transports/websocket/default.js">0.7.9</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.8/lib/transports/websocket/default.js">0.7.8</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.7/lib/transports/websocket/default.js">0.7.7</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.6/lib/transports/websocket/default.js">0.7.6</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.5/lib/transports/websocket/default.js">0.7.5</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.4/lib/transports/websocket/default.js">0.7.4</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.3/lib/transports/websocket/default.js">0.7.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.2/lib/transports/websocket/default.js">0.7.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.1/lib/transports/websocket/default.js">0.7.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.7.0/lib/transports/websocket/default.js">0.7.0</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.17/lib/transports/websocket/default.js">0.6.17</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.16/lib/transports/websocket/default.js">0.6.16</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.15/lib/transports/websocket/default.js">0.6.15</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.14/lib/transports/websocket/default.js">0.6.14</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.13/lib/transports/websocket/default.js">0.6.13</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.12/lib/transports/websocket/default.js">0.6.12</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.11/lib/transports/websocket/default.js">0.6.11</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.10/lib/transports/websocket/default.js">0.6.10</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.9/lib/transports/websocket/default.js">0.6.9</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.8/lib/transports/websocket/default.js">0.6.8</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.7/lib/transports/websocket/default.js">0.6.7</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.6/lib/transports/websocket/default.js">0.6.6</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.5/lib/transports/websocket/default.js">0.6.5</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.4/lib/transports/websocket/default.js">0.6.4</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.3/lib/transports/websocket/default.js">0.6.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.2/lib/transports/websocket/default.js">0.6.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.1/lib/transports/websocket/default.js">0.6.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6.0/lib/transports/websocket/default.js">0.6.0</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.6/lib/transports/websocket/default.js">0.6</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.5.3/lib/transports/websocket/default.js">0.5.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.5.2/lib/transports/websocket/default.js">0.5.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.5.1/lib/transports/websocket/default.js">0.5.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.5/lib/transports/websocket/default.js">0.5</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.4.1/lib/transports/websocket/default.js">0.4.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.4/lib/transports/websocket/default.js">0.4</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.9/lib/transports/websocket/default.js">0.3.9</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.8/lib/transports/websocket/default.js">0.3.8</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.7/lib/transports/websocket/default.js">0.3.7</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.6/lib/transports/websocket/default.js">0.3.6</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.5/lib/transports/websocket/default.js">0.3.5</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.4/lib/transports/websocket/default.js">0.3.4</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.3/lib/transports/websocket/default.js">0.3.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.2/lib/transports/websocket/default.js">0.3.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3.1/lib/transports/websocket/default.js">0.3.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.3/lib/transports/websocket/default.js">0.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.2.3/lib/transports/websocket/default.js">0.2.3</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.2.2/lib/transports/websocket/default.js">0.2.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.2.1/lib/transports/websocket/default.js">0.2.1</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.2/lib/transports/websocket/default.js">0.2</a></li>
            
                      
              <li><a href="/LearnBoost/socket.io/blob/0.1/lib/transports/websocket/default.js">0.1</a></li>
            
                  </ul>
      
    </li>
    <li>
    
    <a href="/LearnBoost/socket.io/branches" class="manage">Branch List</a>
    
    </li>
  </ul>
</div>

  
  
  
  
  
  



        
    <div id="repo_details" class="metabox clearfix">
      <div id="repo_details_loader" class="metabox-loader" style="display:none">Sending Request&hellip;</div>

      
        <a href="/LearnBoost/socket.io/downloads" class="download-source" data-facebox-url="/LearnBoost/socket.io/archives/master" id="download_button" title="Download source, tagged packages and binaries."><span class="icon"></span>Downloads</a>
      

      <div id="repository_desc_wrapper">
      <div id="repository_description" rel="repository_description_edit">
        
          <p>Sockets for the rest of us (in Node.js)
            <span id="read_more" style="display:none">&mdash; <a href="#readme">Read more</a></span>
          </p>
        
      </div>

      <div id="repository_description_edit" style="display:none;" class="inline-edit">
        <form action="/LearnBoost/socket.io/admin/update" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
          <input type="hidden" name="field" value="repository_description">
          <input type="text" class="textfield" name="value" value="Sockets for the rest of us (in Node.js)">
          <div class="form-actions">
            <button class="minibutton"><span>Save</span></button> &nbsp; <a href="#" class="cancel">Cancel</a>
          </div>
        </form>
      </div>

      
      <div class="repository-homepage" id="repository_homepage" rel="repository_homepage_edit">
        <p><a href="http://socket.io" rel="nofollow">http://socket.io</a></p>
      </div>

      <div id="repository_homepage_edit" style="display:none;" class="inline-edit">
        <form action="/LearnBoost/socket.io/admin/update" method="post"><div style="margin:0;padding:0"><input name="authenticity_token" type="hidden" value="91770a44bec472e58cf4f4f381f26d7f69e2c37d" /></div>
          <input type="hidden" name="field" value="repository_homepage">
          <input type="text" class="textfield" name="value" value="http://socket.io">
          <div class="form-actions">
            <button class="minibutton"><span>Save</span></button> &nbsp; <a href="#" class="cancel">Cancel</a>
          </div>
        </form>
      </div>
      </div>
      <div class="rule "></div>
      <div class="url-box">
  
    <ul class="native-clones">
      <li><a href="github-mac://openRepo/https://github.com/LearnBoost/socket.io" class="minibutton btn-clone-in-mac "><span><span class="icon"></span> Clone in Mac</span></a></li>
    </ul>
  

  <ul class="clone-urls">
    
      
      <li class="http_clone_url"><a href="https://github.com/LearnBoost/socket.io.git" data-permissions="Read-Only">HTTP</a></li>
      <li class="public_clone_url"><a href="git://github.com/LearnBoost/socket.io.git" data-permissions="Read-Only">Git Read-Only</a></li>
    
    
  </ul>
  <input type="text" spellcheck="false" class="url-field" />
        <span style="display:none" id="clippy_4306" class="url-box-clippy"></span>
      <span id="clippy_tooltip_clippy_4306" class="clippy-tooltip tooltipped" title="copy to clipboard">
      <object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000"
              width="14"
              height="14"
              class="clippy"
              id="clippy" >
      <param name="movie" value="https://a248.e.akamai.net/assets.github.com/flash/clippy.swf?v5"/>
      <param name="allowScriptAccess" value="always" />
      <param name="quality" value="high" />
      <param name="scale" value="noscale" />
      <param NAME="FlashVars" value="id=clippy_4306&amp;copied=&amp;copyto=">
      <param name="bgcolor" value="#FFFFFF">
      <param name="wmode" value="opaque">
      <embed src="https://a248.e.akamai.net/assets.github.com/flash/clippy.swf?v5"
             width="14"
             height="14"
             name="clippy"
             quality="high"
             allowScriptAccess="always"
             type="application/x-shockwave-flash"
             pluginspage="http://www.macromedia.com/go/getflashplayer"
             FlashVars="id=clippy_4306&amp;copied=&amp;copyto="
             bgcolor="#FFFFFF"
             wmode="opaque"
      />
      </object>
      </span>

  <p class="url-description"><strong>Read+Write</strong> access</p>
</div>

    </div>

    <div class="frame frame-center tree-finder" style="display:none" data-tree-list-url="/LearnBoost/socket.io/tree-list/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40" data-blob-url-prefix="/LearnBoost/socket.io/blob/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40">
      <div class="breadcrumb">
        <b><a href="/LearnBoost/socket.io">socket.io</a></b> /
        <input class="tree-finder-input" type="text" name="query" autocomplete="off" spellcheck="false">
      </div>

      
        <div class="octotip">
          <p>
            <a href="/LearnBoost/socket.io/dismiss-tree-finder-help" class="dismiss js-dismiss-tree-list-help" title="Hide this notice forever">Dismiss</a>
            <strong>Octotip:</strong> You've activated the <em>file finder</em> by pressing <span class="kbd">t</span>
            Start typing to filter the file list. Use <span class="kbd badmono">↑</span> and <span class="kbd badmono">↓</span> to navigate,
            <span class="kbd">enter</span> to view files.
          </p>
        </div>
      

      <table class="tree-browser" cellpadding="0" cellspacing="0">
        <tr class="js-header"><th>&nbsp;</th><th>name</th></tr>
        <tr class="js-no-results no-results" style="display: none">
          <th colspan="2">No matching files</th>
        </tr>
        <tbody class="js-results-list">
        </tbody>
      </table>
    </div>

    <div id="jump-to-line" style="display:none">
      <h2>Jump to Line</h2>
      <form>
        <input class="textfield" type="text">
        <div class="full-button">
          <button type="submit" class="classy">
            <span>Go</span>
          </button>
        </div>
      </form>
    </div>


        

      </div><!-- /.pagehead -->

      

  













  <div id="commit">
    <div class="group">
        
  <div class="envelope commit">
    <div class="human">
      
        <div class="message"><pre><a href="/LearnBoost/socket.io/commit/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40">Merge pull request <a href="https://github.com/LearnBoost/socket.io/issues/502" title="Correction on previous pull req, which left out status code">#502</a> from einaros/master</a> </pre></div>
      

      <div class="actor">
        <div class="gravatar">
          
          <img src="https://secure.gravatar.com/avatar/486e20e16ef676a02ac0299d2f92b813?s=140&d=https://a248.e.akamai.net/assets.github.com%2Fimages%2Fgravatars%2Fgravatar-140.png" alt="" width="30" height="30"  />
        </div>
        <div class="name"><a href="/guille">guille</a> <span>(author)</span></div>
        <div class="date">
          <time class="js-relative-date" datetime="2011-09-01T12:12:32-07:00" title="2011-09-01 12:12:32">September 01, 2011</time>
        </div>
      </div>

      

    </div>
    <div class="machine">
      <span>c</span>ommit&nbsp;&nbsp;<a href="/LearnBoost/socket.io/commit/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40" class="js-commit-link" data-key="c">4d66f78ca2e3001a554b</a><br />
      <span>t</span>ree&nbsp;&nbsp;&nbsp;&nbsp;<a href="/LearnBoost/socket.io/tree/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40" class="js-tree-link" data-key="t">85dcb4eeed36ea8de3a6</a><br />
      
        <span>p</span>arent&nbsp;
        
        <a href="/LearnBoost/socket.io/tree/713baa40e180ba07a345e1c284555137c9ed0b9f" class="js-parent-link" data-key="p">713baa40e180ba07a345</a>
      
        <span>p</span>arent&nbsp;
        
        <a href="/LearnBoost/socket.io/tree/6db6db41a2503b714c1e48c11dfe5027f4889166" class="js-parent-link" data-key="p">6db6db41a2503b714c1e</a>
      

    </div>
  </div>

    </div>
  </div>



  <div id="slider">

  

    <div class="breadcrumb" data-path="lib/transports/websocket/default.js/">
      <b><a href="/LearnBoost/socket.io/tree/713baa40e180ba07a345e1c284555137c9ed0b9f" class="js-rewrite-sha">socket.io</a></b> / <a href="/LearnBoost/socket.io/tree/713baa40e180ba07a345e1c284555137c9ed0b9f/lib" class="js-rewrite-sha">lib</a> / <a href="/LearnBoost/socket.io/tree/713baa40e180ba07a345e1c284555137c9ed0b9f/lib/transports" class="js-rewrite-sha">transports</a> / <a href="/LearnBoost/socket.io/tree/713baa40e180ba07a345e1c284555137c9ed0b9f/lib/transports/websocket" class="js-rewrite-sha">websocket</a> / default.js       <span style="display:none" id="clippy_719" class="clippy">lib/transports/websocket/default.js</span>
      
      <object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000"
              width="110"
              height="14"
              class="clippy"
              id="clippy" >
      <param name="movie" value="https://a248.e.akamai.net/assets.github.com/flash/clippy.swf?v5"/>
      <param name="allowScriptAccess" value="always" />
      <param name="quality" value="high" />
      <param name="scale" value="noscale" />
      <param NAME="FlashVars" value="id=clippy_719&amp;copied=copied!&amp;copyto=copy to clipboard">
      <param name="bgcolor" value="#FFFFFF">
      <param name="wmode" value="opaque">
      <embed src="https://a248.e.akamai.net/assets.github.com/flash/clippy.swf?v5"
             width="110"
             height="14"
             name="clippy"
             quality="high"
             allowScriptAccess="always"
             type="application/x-shockwave-flash"
             pluginspage="http://www.macromedia.com/go/getflashplayer"
             FlashVars="id=clippy_719&amp;copied=copied!&amp;copyto=copy to clipboard"
             bgcolor="#FFFFFF"
             wmode="opaque"
      />
      </object>
      

    </div>

    <div class="frames">
      <div class="frame frame-center" data-path="lib/transports/websocket/default.js/" data-permalink-url="/LearnBoost/socket.io/blob/713baa40e180ba07a345e1c284555137c9ed0b9f/lib/transports/websocket/default.js" data-title="lib/transports/websocket/default.js at master from LearnBoost/socket.io - GitHub" data-type="blob">
        
          <ul class="big-actions">
            
            <li><a class="file-edit-link minibutton" href="/LearnBoost/socket.io/edit/__current_ref__/lib/transports/websocket/default.js"><span>Edit this file</span></a></li>
          </ul>
        

        <div id="files">
          <div class="file">
            <div class="meta">
              <div class="info">
                <span class="icon"><img alt="Txt" height="16" src="https://a248.e.akamai.net/assets.github.com/images/icons/txt.png" width="16" /></span>
                <span class="mode" title="File Mode">100644</span>
                
                  <span>351 lines (280 sloc)</span>
                
                <span>6.743 kb</span>
              </div>
              <ul class="actions">
                <li><a href="/LearnBoost/socket.io/raw/master/lib/transports/websocket/default.js" id="raw-url">raw</a></li>
                
                  <li><a href="/LearnBoost/socket.io/blame/master/lib/transports/websocket/default.js">blame</a></li>
                
                <li><a href="/LearnBoost/socket.io/commits/master/lib/transports/websocket/default.js">history</a></li>
              </ul>
            </div>
            
  <div class="data type-javascript">
    
      <table cellpadding="0" cellspacing="0" class="lines">
        <tr>
          <td>
            <pre class="line_numbers"><span id="L1" rel="#L1">1</span>
<span id="L2" rel="#L2">2</span>
<span id="L3" rel="#L3">3</span>
<span id="L4" rel="#L4">4</span>
<span id="L5" rel="#L5">5</span>
<span id="L6" rel="#L6">6</span>
<span id="L7" rel="#L7">7</span>
<span id="L8" rel="#L8">8</span>
<span id="L9" rel="#L9">9</span>
<span id="L10" rel="#L10">10</span>
<span id="L11" rel="#L11">11</span>
<span id="L12" rel="#L12">12</span>
<span id="L13" rel="#L13">13</span>
<span id="L14" rel="#L14">14</span>
<span id="L15" rel="#L15">15</span>
<span id="L16" rel="#L16">16</span>
<span id="L17" rel="#L17">17</span>
<span id="L18" rel="#L18">18</span>
<span id="L19" rel="#L19">19</span>
<span id="L20" rel="#L20">20</span>
<span id="L21" rel="#L21">21</span>
<span id="L22" rel="#L22">22</span>
<span id="L23" rel="#L23">23</span>
<span id="L24" rel="#L24">24</span>
<span id="L25" rel="#L25">25</span>
<span id="L26" rel="#L26">26</span>
<span id="L27" rel="#L27">27</span>
<span id="L28" rel="#L28">28</span>
<span id="L29" rel="#L29">29</span>
<span id="L30" rel="#L30">30</span>
<span id="L31" rel="#L31">31</span>
<span id="L32" rel="#L32">32</span>
<span id="L33" rel="#L33">33</span>
<span id="L34" rel="#L34">34</span>
<span id="L35" rel="#L35">35</span>
<span id="L36" rel="#L36">36</span>
<span id="L37" rel="#L37">37</span>
<span id="L38" rel="#L38">38</span>
<span id="L39" rel="#L39">39</span>
<span id="L40" rel="#L40">40</span>
<span id="L41" rel="#L41">41</span>
<span id="L42" rel="#L42">42</span>
<span id="L43" rel="#L43">43</span>
<span id="L44" rel="#L44">44</span>
<span id="L45" rel="#L45">45</span>
<span id="L46" rel="#L46">46</span>
<span id="L47" rel="#L47">47</span>
<span id="L48" rel="#L48">48</span>
<span id="L49" rel="#L49">49</span>
<span id="L50" rel="#L50">50</span>
<span id="L51" rel="#L51">51</span>
<span id="L52" rel="#L52">52</span>
<span id="L53" rel="#L53">53</span>
<span id="L54" rel="#L54">54</span>
<span id="L55" rel="#L55">55</span>
<span id="L56" rel="#L56">56</span>
<span id="L57" rel="#L57">57</span>
<span id="L58" rel="#L58">58</span>
<span id="L59" rel="#L59">59</span>
<span id="L60" rel="#L60">60</span>
<span id="L61" rel="#L61">61</span>
<span id="L62" rel="#L62">62</span>
<span id="L63" rel="#L63">63</span>
<span id="L64" rel="#L64">64</span>
<span id="L65" rel="#L65">65</span>
<span id="L66" rel="#L66">66</span>
<span id="L67" rel="#L67">67</span>
<span id="L68" rel="#L68">68</span>
<span id="L69" rel="#L69">69</span>
<span id="L70" rel="#L70">70</span>
<span id="L71" rel="#L71">71</span>
<span id="L72" rel="#L72">72</span>
<span id="L73" rel="#L73">73</span>
<span id="L74" rel="#L74">74</span>
<span id="L75" rel="#L75">75</span>
<span id="L76" rel="#L76">76</span>
<span id="L77" rel="#L77">77</span>
<span id="L78" rel="#L78">78</span>
<span id="L79" rel="#L79">79</span>
<span id="L80" rel="#L80">80</span>
<span id="L81" rel="#L81">81</span>
<span id="L82" rel="#L82">82</span>
<span id="L83" rel="#L83">83</span>
<span id="L84" rel="#L84">84</span>
<span id="L85" rel="#L85">85</span>
<span id="L86" rel="#L86">86</span>
<span id="L87" rel="#L87">87</span>
<span id="L88" rel="#L88">88</span>
<span id="L89" rel="#L89">89</span>
<span id="L90" rel="#L90">90</span>
<span id="L91" rel="#L91">91</span>
<span id="L92" rel="#L92">92</span>
<span id="L93" rel="#L93">93</span>
<span id="L94" rel="#L94">94</span>
<span id="L95" rel="#L95">95</span>
<span id="L96" rel="#L96">96</span>
<span id="L97" rel="#L97">97</span>
<span id="L98" rel="#L98">98</span>
<span id="L99" rel="#L99">99</span>
<span id="L100" rel="#L100">100</span>
<span id="L101" rel="#L101">101</span>
<span id="L102" rel="#L102">102</span>
<span id="L103" rel="#L103">103</span>
<span id="L104" rel="#L104">104</span>
<span id="L105" rel="#L105">105</span>
<span id="L106" rel="#L106">106</span>
<span id="L107" rel="#L107">107</span>
<span id="L108" rel="#L108">108</span>
<span id="L109" rel="#L109">109</span>
<span id="L110" rel="#L110">110</span>
<span id="L111" rel="#L111">111</span>
<span id="L112" rel="#L112">112</span>
<span id="L113" rel="#L113">113</span>
<span id="L114" rel="#L114">114</span>
<span id="L115" rel="#L115">115</span>
<span id="L116" rel="#L116">116</span>
<span id="L117" rel="#L117">117</span>
<span id="L118" rel="#L118">118</span>
<span id="L119" rel="#L119">119</span>
<span id="L120" rel="#L120">120</span>
<span id="L121" rel="#L121">121</span>
<span id="L122" rel="#L122">122</span>
<span id="L123" rel="#L123">123</span>
<span id="L124" rel="#L124">124</span>
<span id="L125" rel="#L125">125</span>
<span id="L126" rel="#L126">126</span>
<span id="L127" rel="#L127">127</span>
<span id="L128" rel="#L128">128</span>
<span id="L129" rel="#L129">129</span>
<span id="L130" rel="#L130">130</span>
<span id="L131" rel="#L131">131</span>
<span id="L132" rel="#L132">132</span>
<span id="L133" rel="#L133">133</span>
<span id="L134" rel="#L134">134</span>
<span id="L135" rel="#L135">135</span>
<span id="L136" rel="#L136">136</span>
<span id="L137" rel="#L137">137</span>
<span id="L138" rel="#L138">138</span>
<span id="L139" rel="#L139">139</span>
<span id="L140" rel="#L140">140</span>
<span id="L141" rel="#L141">141</span>
<span id="L142" rel="#L142">142</span>
<span id="L143" rel="#L143">143</span>
<span id="L144" rel="#L144">144</span>
<span id="L145" rel="#L145">145</span>
<span id="L146" rel="#L146">146</span>
<span id="L147" rel="#L147">147</span>
<span id="L148" rel="#L148">148</span>
<span id="L149" rel="#L149">149</span>
<span id="L150" rel="#L150">150</span>
<span id="L151" rel="#L151">151</span>
<span id="L152" rel="#L152">152</span>
<span id="L153" rel="#L153">153</span>
<span id="L154" rel="#L154">154</span>
<span id="L155" rel="#L155">155</span>
<span id="L156" rel="#L156">156</span>
<span id="L157" rel="#L157">157</span>
<span id="L158" rel="#L158">158</span>
<span id="L159" rel="#L159">159</span>
<span id="L160" rel="#L160">160</span>
<span id="L161" rel="#L161">161</span>
<span id="L162" rel="#L162">162</span>
<span id="L163" rel="#L163">163</span>
<span id="L164" rel="#L164">164</span>
<span id="L165" rel="#L165">165</span>
<span id="L166" rel="#L166">166</span>
<span id="L167" rel="#L167">167</span>
<span id="L168" rel="#L168">168</span>
<span id="L169" rel="#L169">169</span>
<span id="L170" rel="#L170">170</span>
<span id="L171" rel="#L171">171</span>
<span id="L172" rel="#L172">172</span>
<span id="L173" rel="#L173">173</span>
<span id="L174" rel="#L174">174</span>
<span id="L175" rel="#L175">175</span>
<span id="L176" rel="#L176">176</span>
<span id="L177" rel="#L177">177</span>
<span id="L178" rel="#L178">178</span>
<span id="L179" rel="#L179">179</span>
<span id="L180" rel="#L180">180</span>
<span id="L181" rel="#L181">181</span>
<span id="L182" rel="#L182">182</span>
<span id="L183" rel="#L183">183</span>
<span id="L184" rel="#L184">184</span>
<span id="L185" rel="#L185">185</span>
<span id="L186" rel="#L186">186</span>
<span id="L187" rel="#L187">187</span>
<span id="L188" rel="#L188">188</span>
<span id="L189" rel="#L189">189</span>
<span id="L190" rel="#L190">190</span>
<span id="L191" rel="#L191">191</span>
<span id="L192" rel="#L192">192</span>
<span id="L193" rel="#L193">193</span>
<span id="L194" rel="#L194">194</span>
<span id="L195" rel="#L195">195</span>
<span id="L196" rel="#L196">196</span>
<span id="L197" rel="#L197">197</span>
<span id="L198" rel="#L198">198</span>
<span id="L199" rel="#L199">199</span>
<span id="L200" rel="#L200">200</span>
<span id="L201" rel="#L201">201</span>
<span id="L202" rel="#L202">202</span>
<span id="L203" rel="#L203">203</span>
<span id="L204" rel="#L204">204</span>
<span id="L205" rel="#L205">205</span>
<span id="L206" rel="#L206">206</span>
<span id="L207" rel="#L207">207</span>
<span id="L208" rel="#L208">208</span>
<span id="L209" rel="#L209">209</span>
<span id="L210" rel="#L210">210</span>
<span id="L211" rel="#L211">211</span>
<span id="L212" rel="#L212">212</span>
<span id="L213" rel="#L213">213</span>
<span id="L214" rel="#L214">214</span>
<span id="L215" rel="#L215">215</span>
<span id="L216" rel="#L216">216</span>
<span id="L217" rel="#L217">217</span>
<span id="L218" rel="#L218">218</span>
<span id="L219" rel="#L219">219</span>
<span id="L220" rel="#L220">220</span>
<span id="L221" rel="#L221">221</span>
<span id="L222" rel="#L222">222</span>
<span id="L223" rel="#L223">223</span>
<span id="L224" rel="#L224">224</span>
<span id="L225" rel="#L225">225</span>
<span id="L226" rel="#L226">226</span>
<span id="L227" rel="#L227">227</span>
<span id="L228" rel="#L228">228</span>
<span id="L229" rel="#L229">229</span>
<span id="L230" rel="#L230">230</span>
<span id="L231" rel="#L231">231</span>
<span id="L232" rel="#L232">232</span>
<span id="L233" rel="#L233">233</span>
<span id="L234" rel="#L234">234</span>
<span id="L235" rel="#L235">235</span>
<span id="L236" rel="#L236">236</span>
<span id="L237" rel="#L237">237</span>
<span id="L238" rel="#L238">238</span>
<span id="L239" rel="#L239">239</span>
<span id="L240" rel="#L240">240</span>
<span id="L241" rel="#L241">241</span>
<span id="L242" rel="#L242">242</span>
<span id="L243" rel="#L243">243</span>
<span id="L244" rel="#L244">244</span>
<span id="L245" rel="#L245">245</span>
<span id="L246" rel="#L246">246</span>
<span id="L247" rel="#L247">247</span>
<span id="L248" rel="#L248">248</span>
<span id="L249" rel="#L249">249</span>
<span id="L250" rel="#L250">250</span>
<span id="L251" rel="#L251">251</span>
<span id="L252" rel="#L252">252</span>
<span id="L253" rel="#L253">253</span>
<span id="L254" rel="#L254">254</span>
<span id="L255" rel="#L255">255</span>
<span id="L256" rel="#L256">256</span>
<span id="L257" rel="#L257">257</span>
<span id="L258" rel="#L258">258</span>
<span id="L259" rel="#L259">259</span>
<span id="L260" rel="#L260">260</span>
<span id="L261" rel="#L261">261</span>
<span id="L262" rel="#L262">262</span>
<span id="L263" rel="#L263">263</span>
<span id="L264" rel="#L264">264</span>
<span id="L265" rel="#L265">265</span>
<span id="L266" rel="#L266">266</span>
<span id="L267" rel="#L267">267</span>
<span id="L268" rel="#L268">268</span>
<span id="L269" rel="#L269">269</span>
<span id="L270" rel="#L270">270</span>
<span id="L271" rel="#L271">271</span>
<span id="L272" rel="#L272">272</span>
<span id="L273" rel="#L273">273</span>
<span id="L274" rel="#L274">274</span>
<span id="L275" rel="#L275">275</span>
<span id="L276" rel="#L276">276</span>
<span id="L277" rel="#L277">277</span>
<span id="L278" rel="#L278">278</span>
<span id="L279" rel="#L279">279</span>
<span id="L280" rel="#L280">280</span>
<span id="L281" rel="#L281">281</span>
<span id="L282" rel="#L282">282</span>
<span id="L283" rel="#L283">283</span>
<span id="L284" rel="#L284">284</span>
<span id="L285" rel="#L285">285</span>
<span id="L286" rel="#L286">286</span>
<span id="L287" rel="#L287">287</span>
<span id="L288" rel="#L288">288</span>
<span id="L289" rel="#L289">289</span>
<span id="L290" rel="#L290">290</span>
<span id="L291" rel="#L291">291</span>
<span id="L292" rel="#L292">292</span>
<span id="L293" rel="#L293">293</span>
<span id="L294" rel="#L294">294</span>
<span id="L295" rel="#L295">295</span>
<span id="L296" rel="#L296">296</span>
<span id="L297" rel="#L297">297</span>
<span id="L298" rel="#L298">298</span>
<span id="L299" rel="#L299">299</span>
<span id="L300" rel="#L300">300</span>
<span id="L301" rel="#L301">301</span>
<span id="L302" rel="#L302">302</span>
<span id="L303" rel="#L303">303</span>
<span id="L304" rel="#L304">304</span>
<span id="L305" rel="#L305">305</span>
<span id="L306" rel="#L306">306</span>
<span id="L307" rel="#L307">307</span>
<span id="L308" rel="#L308">308</span>
<span id="L309" rel="#L309">309</span>
<span id="L310" rel="#L310">310</span>
<span id="L311" rel="#L311">311</span>
<span id="L312" rel="#L312">312</span>
<span id="L313" rel="#L313">313</span>
<span id="L314" rel="#L314">314</span>
<span id="L315" rel="#L315">315</span>
<span id="L316" rel="#L316">316</span>
<span id="L317" rel="#L317">317</span>
<span id="L318" rel="#L318">318</span>
<span id="L319" rel="#L319">319</span>
<span id="L320" rel="#L320">320</span>
<span id="L321" rel="#L321">321</span>
<span id="L322" rel="#L322">322</span>
<span id="L323" rel="#L323">323</span>
<span id="L324" rel="#L324">324</span>
<span id="L325" rel="#L325">325</span>
<span id="L326" rel="#L326">326</span>
<span id="L327" rel="#L327">327</span>
<span id="L328" rel="#L328">328</span>
<span id="L329" rel="#L329">329</span>
<span id="L330" rel="#L330">330</span>
<span id="L331" rel="#L331">331</span>
<span id="L332" rel="#L332">332</span>
<span id="L333" rel="#L333">333</span>
<span id="L334" rel="#L334">334</span>
<span id="L335" rel="#L335">335</span>
<span id="L336" rel="#L336">336</span>
<span id="L337" rel="#L337">337</span>
<span id="L338" rel="#L338">338</span>
<span id="L339" rel="#L339">339</span>
<span id="L340" rel="#L340">340</span>
<span id="L341" rel="#L341">341</span>
<span id="L342" rel="#L342">342</span>
<span id="L343" rel="#L343">343</span>
<span id="L344" rel="#L344">344</span>
<span id="L345" rel="#L345">345</span>
<span id="L346" rel="#L346">346</span>
<span id="L347" rel="#L347">347</span>
<span id="L348" rel="#L348">348</span>
<span id="L349" rel="#L349">349</span>
<span id="L350" rel="#L350">350</span>
<span id="L351" rel="#L351">351</span>
</pre>
          </td>
          <td width="100%">
            
              
                <div class="highlight"><pre><div class='line' id='LC1'><br/></div><div class='line' id='LC2'><span class="cm">/*!</span></div><div class='line' id='LC3'><span class="cm"> * socket.io-node</span></div><div class='line' id='LC4'><span class="cm"> * Copyright(c) 2011 LearnBoost &lt;dev@learnboost.com&gt;</span></div><div class='line' id='LC5'><span class="cm"> * MIT Licensed</span></div><div class='line' id='LC6'><span class="cm"> */</span></div><div class='line' id='LC7'><br/></div><div class='line' id='LC8'><span class="cm">/**</span></div><div class='line' id='LC9'><span class="cm"> * Module requirements.</span></div><div class='line' id='LC10'><span class="cm"> */</span></div><div class='line' id='LC11'><br/></div><div class='line' id='LC12'><span class="kd">var</span> <span class="nx">Transport</span> <span class="o">=</span> <span class="nx">require</span><span class="p">(</span><span class="s1">&#39;../../transport&#39;</span><span class="p">)</span></div><div class='line' id='LC13'>&nbsp;&nbsp;<span class="p">,</span> <span class="nx">EventEmitter</span> <span class="o">=</span> <span class="nx">process</span><span class="p">.</span><span class="nx">EventEmitter</span></div><div class='line' id='LC14'>&nbsp;&nbsp;<span class="p">,</span> <span class="nx">crypto</span> <span class="o">=</span> <span class="nx">require</span><span class="p">(</span><span class="s1">&#39;crypto&#39;</span><span class="p">)</span></div><div class='line' id='LC15'>&nbsp;&nbsp;<span class="p">,</span> <span class="nx">parser</span> <span class="o">=</span> <span class="nx">require</span><span class="p">(</span><span class="s1">&#39;../../parser&#39;</span><span class="p">);</span></div><div class='line' id='LC16'><br/></div><div class='line' id='LC17'><span class="cm">/**</span></div><div class='line' id='LC18'><span class="cm"> * Export the constructor.</span></div><div class='line' id='LC19'><span class="cm"> */</span></div><div class='line' id='LC20'><br/></div><div class='line' id='LC21'><span class="nx">exports</span> <span class="o">=</span> <span class="nx">module</span><span class="p">.</span><span class="nx">exports</span> <span class="o">=</span> <span class="nx">WebSocket</span><span class="p">;</span></div><div class='line' id='LC22'><br/></div><div class='line' id='LC23'><span class="cm">/**</span></div><div class='line' id='LC24'><span class="cm"> * HTTP interface constructor. Interface compatible with all transports that</span></div><div class='line' id='LC25'><span class="cm"> * depend on request-response cycles.</span></div><div class='line' id='LC26'><span class="cm"> *</span></div><div class='line' id='LC27'><span class="cm"> * @api public</span></div><div class='line' id='LC28'><span class="cm"> */</span></div><div class='line' id='LC29'><br/></div><div class='line' id='LC30'><span class="kd">function</span> <span class="nx">WebSocket</span> <span class="p">(</span><span class="nx">mng</span><span class="p">,</span> <span class="nx">data</span><span class="p">,</span> <span class="nx">req</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC31'>&nbsp;&nbsp;<span class="c1">// parser</span></div><div class='line' id='LC32'>&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">self</span> <span class="o">=</span> <span class="k">this</span><span class="p">;</span></div><div class='line' id='LC33'><br/></div><div class='line' id='LC34'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">parser</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Parser</span><span class="p">();</span></div><div class='line' id='LC35'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">parser</span><span class="p">.</span><span class="nx">on</span><span class="p">(</span><span class="s1">&#39;data&#39;</span><span class="p">,</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">packet</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC36'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">log</span><span class="p">.</span><span class="nx">debug</span><span class="p">(</span><span class="nx">self</span><span class="p">.</span><span class="nx">name</span> <span class="o">+</span> <span class="s1">&#39; received data packet&#39;</span><span class="p">,</span> <span class="nx">packet</span><span class="p">);</span></div><div class='line' id='LC37'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">onMessage</span><span class="p">(</span><span class="nx">parser</span><span class="p">.</span><span class="nx">decodePacket</span><span class="p">(</span><span class="nx">packet</span><span class="p">));</span></div><div class='line' id='LC38'>&nbsp;&nbsp;<span class="p">});</span></div><div class='line' id='LC39'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">parser</span><span class="p">.</span><span class="nx">on</span><span class="p">(</span><span class="s1">&#39;close&#39;</span><span class="p">,</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC40'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC41'>&nbsp;&nbsp;<span class="p">});</span></div><div class='line' id='LC42'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">parser</span><span class="p">.</span><span class="nx">on</span><span class="p">(</span><span class="s1">&#39;error&#39;</span><span class="p">,</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC43'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC44'>&nbsp;&nbsp;<span class="p">});</span></div><div class='line' id='LC45'><br/></div><div class='line' id='LC46'>&nbsp;&nbsp;<span class="nx">Transport</span><span class="p">.</span><span class="nx">call</span><span class="p">(</span><span class="k">this</span><span class="p">,</span> <span class="nx">mng</span><span class="p">,</span> <span class="nx">data</span><span class="p">,</span> <span class="nx">req</span><span class="p">);</span></div><div class='line' id='LC47'><span class="p">};</span></div><div class='line' id='LC48'><br/></div><div class='line' id='LC49'><span class="cm">/**</span></div><div class='line' id='LC50'><span class="cm"> * Inherits from Transport.</span></div><div class='line' id='LC51'><span class="cm"> */</span></div><div class='line' id='LC52'><br/></div><div class='line' id='LC53'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">__proto__</span> <span class="o">=</span> <span class="nx">Transport</span><span class="p">.</span><span class="nx">prototype</span><span class="p">;</span></div><div class='line' id='LC54'><br/></div><div class='line' id='LC55'><span class="cm">/**</span></div><div class='line' id='LC56'><span class="cm"> * Transport name</span></div><div class='line' id='LC57'><span class="cm"> *</span></div><div class='line' id='LC58'><span class="cm"> * @api public</span></div><div class='line' id='LC59'><span class="cm"> */</span></div><div class='line' id='LC60'><br/></div><div class='line' id='LC61'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">name</span> <span class="o">=</span> <span class="s1">&#39;websocket&#39;</span><span class="p">;</span></div><div class='line' id='LC62'><br/></div><div class='line' id='LC63'><span class="cm">/**</span></div><div class='line' id='LC64'><span class="cm"> * Called when the socket connects.</span></div><div class='line' id='LC65'><span class="cm"> *</span></div><div class='line' id='LC66'><span class="cm"> * @api private</span></div><div class='line' id='LC67'><span class="cm"> */</span></div><div class='line' id='LC68'><br/></div><div class='line' id='LC69'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">onSocketConnect</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC70'>&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">self</span> <span class="o">=</span> <span class="k">this</span><span class="p">;</span></div><div class='line' id='LC71'><br/></div><div class='line' id='LC72'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setNoDelay</span><span class="p">(</span><span class="kc">true</span><span class="p">);</span></div><div class='line' id='LC73'><br/></div><div class='line' id='LC74'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="kc">true</span><span class="p">;</span></div><div class='line' id='LC75'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffered</span> <span class="o">=</span> <span class="p">[];</span></div><div class='line' id='LC76'><br/></div><div class='line' id='LC77'>&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">.</span><span class="nx">upgrade</span> <span class="o">!==</span> <span class="s1">&#39;WebSocket&#39;</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC78'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">log</span><span class="p">.</span><span class="nx">warn</span><span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">name</span> <span class="o">+</span> <span class="s1">&#39; connection invalid&#39;</span><span class="p">);</span></div><div class='line' id='LC79'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC80'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span><span class="p">;</span></div><div class='line' id='LC81'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC82'><br/></div><div class='line' id='LC83'>&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">origin</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">.</span><span class="nx">origin</span></div><div class='line' id='LC84'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">location</span> <span class="o">=</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">encrypted</span> <span class="o">?</span> <span class="s1">&#39;wss&#39;</span> <span class="o">:</span> <span class="s1">&#39;ws&#39;</span><span class="p">)</span></div><div class='line' id='LC85'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="o">+</span> <span class="s1">&#39;://&#39;</span> <span class="o">+</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">.</span><span class="nx">host</span> <span class="o">+</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">url</span></div><div class='line' id='LC86'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">waitingForNonce</span> <span class="o">=</span> <span class="kc">false</span><span class="p">;</span></div><div class='line' id='LC87'><br/></div><div class='line' id='LC88'>&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">[</span><span class="s1">&#39;sec-websocket-key1&#39;</span><span class="p">])</span> <span class="p">{</span></div><div class='line' id='LC89'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="c1">// If we don&#39;t have the nonce yet, wait for it (HAProxy compatibility).</span></div><div class='line' id='LC90'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="o">!</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">head</span> <span class="o">&amp;&amp;</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">head</span><span class="p">.</span><span class="nx">length</span> <span class="o">&gt;=</span> <span class="mi">8</span><span class="p">))</span> <span class="p">{</span></div><div class='line' id='LC91'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">waitingForNonce</span> <span class="o">=</span> <span class="kc">true</span><span class="p">;</span></div><div class='line' id='LC92'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC93'><br/></div><div class='line' id='LC94'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">headers</span> <span class="o">=</span> <span class="p">[</span></div><div class='line' id='LC95'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="s1">&#39;HTTP/1.1 101 WebSocket Protocol Handshake&#39;</span></div><div class='line' id='LC96'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Upgrade: WebSocket&#39;</span></div><div class='line' id='LC97'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Connection: Upgrade&#39;</span></div><div class='line' id='LC98'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Sec-WebSocket-Origin: &#39;</span> <span class="o">+</span> <span class="nx">origin</span></div><div class='line' id='LC99'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Sec-WebSocket-Location: &#39;</span> <span class="o">+</span> <span class="nx">location</span></div><div class='line' id='LC100'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">];</span></div><div class='line' id='LC101'><br/></div><div class='line' id='LC102'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">[</span><span class="s1">&#39;sec-websocket-protocol&#39;</span><span class="p">]){</span></div><div class='line' id='LC103'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">headers</span><span class="p">.</span><span class="nx">push</span><span class="p">(</span><span class="s1">&#39;Sec-WebSocket-Protocol: &#39;</span></div><div class='line' id='LC104'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="o">+</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">[</span><span class="s1">&#39;sec-websocket-protocol&#39;</span><span class="p">]);</span></div><div class='line' id='LC105'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC106'>&nbsp;&nbsp;<span class="p">}</span> <span class="k">else</span> <span class="p">{</span></div><div class='line' id='LC107'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">headers</span> <span class="o">=</span> <span class="p">[</span></div><div class='line' id='LC108'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="s1">&#39;HTTP/1.1 101 Web Socket Protocol Handshake&#39;</span></div><div class='line' id='LC109'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Upgrade: WebSocket&#39;</span></div><div class='line' id='LC110'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;Connection: Upgrade&#39;</span></div><div class='line' id='LC111'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;WebSocket-Origin: &#39;</span> <span class="o">+</span> <span class="nx">origin</span></div><div class='line' id='LC112'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="s1">&#39;WebSocket-Location: &#39;</span> <span class="o">+</span> <span class="nx">location</span></div><div class='line' id='LC113'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">];</span></div><div class='line' id='LC114'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC115'><br/></div><div class='line' id='LC116'>&nbsp;&nbsp;<span class="k">try</span> <span class="p">{</span></div><div class='line' id='LC117'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="nx">headers</span><span class="p">.</span><span class="nx">concat</span><span class="p">(</span><span class="s1">&#39;&#39;</span><span class="p">,</span> <span class="s1">&#39;&#39;</span><span class="p">).</span><span class="nx">join</span><span class="p">(</span><span class="s1">&#39;\r\n&#39;</span><span class="p">));</span></div><div class='line' id='LC118'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setTimeout</span><span class="p">(</span><span class="mi">0</span><span class="p">);</span></div><div class='line' id='LC119'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setNoDelay</span><span class="p">(</span><span class="kc">true</span><span class="p">);</span></div><div class='line' id='LC120'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setEncoding</span><span class="p">(</span><span class="s1">&#39;utf8&#39;</span><span class="p">);</span></div><div class='line' id='LC121'>&nbsp;&nbsp;<span class="p">}</span> <span class="k">catch</span> <span class="p">(</span><span class="nx">e</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC122'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC123'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span><span class="p">;</span></div><div class='line' id='LC124'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC125'><br/></div><div class='line' id='LC126'>&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">waitingForNonce</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC127'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setEncoding</span><span class="p">(</span><span class="s1">&#39;binary&#39;</span><span class="p">);</span></div><div class='line' id='LC128'>&nbsp;&nbsp;<span class="p">}</span> <span class="k">else</span> <span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">proveReception</span><span class="p">(</span><span class="nx">headers</span><span class="p">))</span> <span class="p">{</span></div><div class='line' id='LC129'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">flush</span><span class="p">();</span></div><div class='line' id='LC130'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC131'><br/></div><div class='line' id='LC132'>&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">headBuffer</span> <span class="o">=</span> <span class="s1">&#39;&#39;</span><span class="p">;</span></div><div class='line' id='LC133'><br/></div><div class='line' id='LC134'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">on</span><span class="p">(</span><span class="s1">&#39;data&#39;</span><span class="p">,</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">data</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC135'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">waitingForNonce</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC136'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">headBuffer</span> <span class="o">+=</span> <span class="nx">data</span><span class="p">;</span></div><div class='line' id='LC137'><br/></div><div class='line' id='LC138'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">headBuffer</span><span class="p">.</span><span class="nx">length</span> <span class="o">&lt;</span> <span class="mi">8</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC139'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span><span class="p">;</span></div><div class='line' id='LC140'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC141'><br/></div><div class='line' id='LC142'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="c1">// Restore the connection to utf8 encoding after receiving the nonce</span></div><div class='line' id='LC143'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">setEncoding</span><span class="p">(</span><span class="s1">&#39;utf8&#39;</span><span class="p">);</span></div><div class='line' id='LC144'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">waitingForNonce</span> <span class="o">=</span> <span class="kc">false</span><span class="p">;</span></div><div class='line' id='LC145'><br/></div><div class='line' id='LC146'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="c1">// Stuff the nonce into the location where it&#39;s expected to be</span></div><div class='line' id='LC147'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">head</span> <span class="o">=</span> <span class="nx">headBuffer</span><span class="p">.</span><span class="nx">substr</span><span class="p">(</span><span class="mi">0</span><span class="p">,</span> <span class="mi">8</span><span class="p">);</span></div><div class='line' id='LC148'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">headBuffer</span> <span class="o">=</span> <span class="s1">&#39;&#39;</span><span class="p">;</span></div><div class='line' id='LC149'><br/></div><div class='line' id='LC150'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">self</span><span class="p">.</span><span class="nx">proveReception</span><span class="p">(</span><span class="nx">headers</span><span class="p">))</span> <span class="p">{</span></div><div class='line' id='LC151'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">flush</span><span class="p">();</span></div><div class='line' id='LC152'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC153'><br/></div><div class='line' id='LC154'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span><span class="p">;</span></div><div class='line' id='LC155'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC156'><br/></div><div class='line' id='LC157'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">parser</span><span class="p">.</span><span class="nx">add</span><span class="p">(</span><span class="nx">data</span><span class="p">);</span></div><div class='line' id='LC158'>&nbsp;&nbsp;<span class="p">});</span></div><div class='line' id='LC159'><span class="p">};</span></div><div class='line' id='LC160'><br/></div><div class='line' id='LC161'><span class="cm">/**</span></div><div class='line' id='LC162'><span class="cm"> * Writes to the socket.</span></div><div class='line' id='LC163'><span class="cm"> *</span></div><div class='line' id='LC164'><span class="cm"> * @api private</span></div><div class='line' id='LC165'><span class="cm"> */</span></div><div class='line' id='LC166'><br/></div><div class='line' id='LC167'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">write</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">data</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC168'>&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">open</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC169'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">drained</span> <span class="o">=</span> <span class="kc">false</span><span class="p">;</span></div><div class='line' id='LC170'><br/></div><div class='line' id='LC171'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC172'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffered</span><span class="p">.</span><span class="nx">push</span><span class="p">(</span><span class="nx">data</span><span class="p">);</span></div><div class='line' id='LC173'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span> <span class="k">this</span><span class="p">;</span></div><div class='line' id='LC174'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC175'><br/></div><div class='line' id='LC176'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">length</span> <span class="o">=</span> <span class="nx">Buffer</span><span class="p">.</span><span class="nx">byteLength</span><span class="p">(</span><span class="nx">data</span><span class="p">)</span></div><div class='line' id='LC177'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">buffer</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Buffer</span><span class="p">(</span><span class="mi">2</span> <span class="o">+</span> <span class="nx">length</span><span class="p">);</span></div><div class='line' id='LC178'><br/></div><div class='line' id='LC179'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">buffer</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="s1">&#39;\x00&#39;</span><span class="p">,</span> <span class="s1">&#39;binary&#39;</span><span class="p">);</span></div><div class='line' id='LC180'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">buffer</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="nx">data</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="s1">&#39;utf8&#39;</span><span class="p">);</span></div><div class='line' id='LC181'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">buffer</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="s1">&#39;\xff&#39;</span><span class="p">,</span> <span class="mi">1</span> <span class="o">+</span> <span class="nx">length</span><span class="p">,</span> <span class="s1">&#39;binary&#39;</span><span class="p">);</span></div><div class='line' id='LC182'><br/></div><div class='line' id='LC183'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">try</span> <span class="p">{</span></div><div class='line' id='LC184'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="nx">buffer</span><span class="p">))</span> <span class="p">{</span></div><div class='line' id='LC185'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">drained</span> <span class="o">=</span> <span class="kc">true</span><span class="p">;</span></div><div class='line' id='LC186'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC187'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span> <span class="k">catch</span> <span class="p">(</span><span class="nx">e</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC188'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC189'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC190'><br/></div><div class='line' id='LC191'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">log</span><span class="p">.</span><span class="nx">debug</span><span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">name</span> <span class="o">+</span> <span class="s1">&#39; writing&#39;</span><span class="p">,</span> <span class="nx">data</span><span class="p">);</span></div><div class='line' id='LC192'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC193'><span class="p">};</span></div><div class='line' id='LC194'><br/></div><div class='line' id='LC195'><span class="cm">/**</span></div><div class='line' id='LC196'><span class="cm"> * Flushes the internal buffer</span></div><div class='line' id='LC197'><span class="cm"> *</span></div><div class='line' id='LC198'><span class="cm"> * @api private</span></div><div class='line' id='LC199'><span class="cm"> */</span></div><div class='line' id='LC200'><br/></div><div class='line' id='LC201'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">flush</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC202'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="kc">false</span><span class="p">;</span></div><div class='line' id='LC203'><br/></div><div class='line' id='LC204'>&nbsp;&nbsp;<span class="k">for</span> <span class="p">(</span><span class="kd">var</span> <span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">,</span> <span class="nx">l</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffered</span><span class="p">.</span><span class="nx">length</span><span class="p">;</span> <span class="nx">i</span> <span class="o">&lt;</span> <span class="nx">l</span><span class="p">;</span> <span class="nx">i</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC205'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">buffered</span><span class="p">.</span><span class="nx">splice</span><span class="p">(</span><span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">)[</span><span class="mi">0</span><span class="p">]);</span></div><div class='line' id='LC206'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC207'><span class="p">};</span></div><div class='line' id='LC208'><br/></div><div class='line' id='LC209'><span class="cm">/**</span></div><div class='line' id='LC210'><span class="cm"> * Finishes the handshake.</span></div><div class='line' id='LC211'><span class="cm"> *</span></div><div class='line' id='LC212'><span class="cm"> * @api private</span></div><div class='line' id='LC213'><span class="cm"> */</span></div><div class='line' id='LC214'><br/></div><div class='line' id='LC215'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">proveReception</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">headers</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC216'>&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">self</span> <span class="o">=</span> <span class="k">this</span></div><div class='line' id='LC217'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">k1</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">[</span><span class="s1">&#39;sec-websocket-key1&#39;</span><span class="p">]</span></div><div class='line' id='LC218'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">k2</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">headers</span><span class="p">[</span><span class="s1">&#39;sec-websocket-key2&#39;</span><span class="p">];</span></div><div class='line' id='LC219'><br/></div><div class='line' id='LC220'>&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">k1</span> <span class="o">&amp;&amp;</span> <span class="nx">k2</span><span class="p">){</span></div><div class='line' id='LC221'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">md5</span> <span class="o">=</span> <span class="nx">crypto</span><span class="p">.</span><span class="nx">createHash</span><span class="p">(</span><span class="s1">&#39;md5&#39;</span><span class="p">);</span></div><div class='line' id='LC222'><br/></div><div class='line' id='LC223'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">[</span><span class="nx">k1</span><span class="p">,</span> <span class="nx">k2</span><span class="p">].</span><span class="nx">forEach</span><span class="p">(</span><span class="kd">function</span> <span class="p">(</span><span class="nx">k</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC224'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kd">var</span> <span class="nx">n</span> <span class="o">=</span> <span class="nb">parseInt</span><span class="p">(</span><span class="nx">k</span><span class="p">.</span><span class="nx">replace</span><span class="p">(</span><span class="sr">/[^\d]/g</span><span class="p">,</span> <span class="s1">&#39;&#39;</span><span class="p">))</span></div><div class='line' id='LC225'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">,</span> <span class="nx">spaces</span> <span class="o">=</span> <span class="nx">k</span><span class="p">.</span><span class="nx">replace</span><span class="p">(</span><span class="sr">/[^ ]/g</span><span class="p">,</span> <span class="s1">&#39;&#39;</span><span class="p">).</span><span class="nx">length</span><span class="p">;</span></div><div class='line' id='LC226'><br/></div><div class='line' id='LC227'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">spaces</span> <span class="o">===</span> <span class="mi">0</span> <span class="o">||</span> <span class="nx">n</span> <span class="o">%</span> <span class="nx">spaces</span> <span class="o">!==</span> <span class="mi">0</span><span class="p">){</span></div><div class='line' id='LC228'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">log</span><span class="p">.</span><span class="nx">warn</span><span class="p">(</span><span class="s1">&#39;Invalid &#39;</span> <span class="o">+</span> <span class="nx">self</span><span class="p">.</span><span class="nx">name</span> <span class="o">+</span> <span class="s1">&#39; key: &quot;&#39;</span> <span class="o">+</span> <span class="nx">k</span> <span class="o">+</span> <span class="s1">&#39;&quot;.&#39;</span><span class="p">);</span></div><div class='line' id='LC229'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">self</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC230'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span> <span class="kc">false</span><span class="p">;</span></div><div class='line' id='LC231'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC232'><br/></div><div class='line' id='LC233'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">n</span> <span class="o">/=</span> <span class="nx">spaces</span><span class="p">;</span></div><div class='line' id='LC234'><br/></div><div class='line' id='LC235'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">md5</span><span class="p">.</span><span class="nx">update</span><span class="p">(</span><span class="nb">String</span><span class="p">.</span><span class="nx">fromCharCode</span><span class="p">(</span></div><div class='line' id='LC236'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">n</span> <span class="o">&gt;&gt;</span> <span class="mi">24</span> <span class="o">&amp;</span> <span class="mh">0xFF</span><span class="p">,</span></div><div class='line' id='LC237'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">n</span> <span class="o">&gt;&gt;</span> <span class="mi">16</span> <span class="o">&amp;</span> <span class="mh">0xFF</span><span class="p">,</span></div><div class='line' id='LC238'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">n</span> <span class="o">&gt;&gt;</span> <span class="mi">8</span>  <span class="o">&amp;</span> <span class="mh">0xFF</span><span class="p">,</span></div><div class='line' id='LC239'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">n</span>       <span class="o">&amp;</span> <span class="mh">0xFF</span><span class="p">));</span></div><div class='line' id='LC240'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">});</span></div><div class='line' id='LC241'><br/></div><div class='line' id='LC242'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">md5</span><span class="p">.</span><span class="nx">update</span><span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">req</span><span class="p">.</span><span class="nx">head</span><span class="p">.</span><span class="nx">toString</span><span class="p">(</span><span class="s1">&#39;binary&#39;</span><span class="p">));</span></div><div class='line' id='LC243'><br/></div><div class='line' id='LC244'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">try</span> <span class="p">{</span></div><div class='line' id='LC245'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="nx">md5</span><span class="p">.</span><span class="nx">digest</span><span class="p">(</span><span class="s1">&#39;binary&#39;</span><span class="p">),</span> <span class="s1">&#39;binary&#39;</span><span class="p">);</span></div><div class='line' id='LC246'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span> <span class="k">catch</span> <span class="p">(</span><span class="nx">e</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC247'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC248'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC249'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC250'><br/></div><div class='line' id='LC251'>&nbsp;&nbsp;<span class="k">return</span> <span class="kc">true</span><span class="p">;</span></div><div class='line' id='LC252'><span class="p">};</span></div><div class='line' id='LC253'><br/></div><div class='line' id='LC254'><span class="cm">/**</span></div><div class='line' id='LC255'><span class="cm"> * Writes a payload.</span></div><div class='line' id='LC256'><span class="cm"> *</span></div><div class='line' id='LC257'><span class="cm"> * @api private</span></div><div class='line' id='LC258'><span class="cm"> */</span></div><div class='line' id='LC259'><br/></div><div class='line' id='LC260'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">payload</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">msgs</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC261'>&nbsp;&nbsp;<span class="k">for</span> <span class="p">(</span><span class="kd">var</span> <span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">,</span> <span class="nx">l</span> <span class="o">=</span> <span class="nx">msgs</span><span class="p">.</span><span class="nx">length</span><span class="p">;</span> <span class="nx">i</span> <span class="o">&lt;</span> <span class="nx">l</span><span class="p">;</span> <span class="nx">i</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC262'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">write</span><span class="p">(</span><span class="nx">msgs</span><span class="p">[</span><span class="nx">i</span><span class="p">]);</span></div><div class='line' id='LC263'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC264'><br/></div><div class='line' id='LC265'>&nbsp;&nbsp;<span class="k">return</span> <span class="k">this</span><span class="p">;</span></div><div class='line' id='LC266'><span class="p">};</span></div><div class='line' id='LC267'><br/></div><div class='line' id='LC268'><span class="cm">/**</span></div><div class='line' id='LC269'><span class="cm"> * Closes the connection.</span></div><div class='line' id='LC270'><span class="cm"> *</span></div><div class='line' id='LC271'><span class="cm"> * @api private</span></div><div class='line' id='LC272'><span class="cm"> */</span></div><div class='line' id='LC273'><br/></div><div class='line' id='LC274'><span class="nx">WebSocket</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">doClose</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC275'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">socket</span><span class="p">.</span><span class="nx">end</span><span class="p">();</span></div><div class='line' id='LC276'><span class="p">};</span></div><div class='line' id='LC277'><br/></div><div class='line' id='LC278'><span class="cm">/**</span></div><div class='line' id='LC279'><span class="cm"> * WebSocket parser</span></div><div class='line' id='LC280'><span class="cm"> *</span></div><div class='line' id='LC281'><span class="cm"> * @api public</span></div><div class='line' id='LC282'><span class="cm"> */</span></div><div class='line' id='LC283'><br/></div><div class='line' id='LC284'><span class="kd">function</span> <span class="nx">Parser</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC285'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="s1">&#39;&#39;</span><span class="p">;</span></div><div class='line' id='LC286'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span></div><div class='line' id='LC287'><span class="p">};</span></div><div class='line' id='LC288'><br/></div><div class='line' id='LC289'><span class="cm">/**</span></div><div class='line' id='LC290'><span class="cm"> * Inherits from EventEmitter.</span></div><div class='line' id='LC291'><span class="cm"> */</span></div><div class='line' id='LC292'><br/></div><div class='line' id='LC293'><span class="nx">Parser</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">__proto__</span> <span class="o">=</span> <span class="nx">EventEmitter</span><span class="p">.</span><span class="nx">prototype</span><span class="p">;</span></div><div class='line' id='LC294'><br/></div><div class='line' id='LC295'><span class="cm">/**</span></div><div class='line' id='LC296'><span class="cm"> * Adds data to the buffer.</span></div><div class='line' id='LC297'><span class="cm"> *</span></div><div class='line' id='LC298'><span class="cm"> * @api public</span></div><div class='line' id='LC299'><span class="cm"> */</span></div><div class='line' id='LC300'><br/></div><div class='line' id='LC301'><span class="nx">Parser</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">add</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">data</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC302'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">+=</span> <span class="nx">data</span><span class="p">;</span></div><div class='line' id='LC303'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">parse</span><span class="p">();</span></div><div class='line' id='LC304'><span class="p">};</span></div><div class='line' id='LC305'><br/></div><div class='line' id='LC306'><span class="cm">/**</span></div><div class='line' id='LC307'><span class="cm"> * Parses the buffer.</span></div><div class='line' id='LC308'><span class="cm"> *</span></div><div class='line' id='LC309'><span class="cm"> * @api private</span></div><div class='line' id='LC310'><span class="cm"> */</span></div><div class='line' id='LC311'><br/></div><div class='line' id='LC312'><span class="nx">Parser</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">parse</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">()</span> <span class="p">{</span></div><div class='line' id='LC313'>&nbsp;&nbsp;<span class="k">for</span> <span class="p">(</span><span class="kd">var</span> <span class="nx">i</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">i</span><span class="p">,</span> <span class="nx">chr</span><span class="p">,</span> <span class="nx">l</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">.</span><span class="nx">length</span><span class="p">;</span> <span class="nx">i</span> <span class="o">&lt;</span> <span class="nx">l</span><span class="p">;</span> <span class="nx">i</span><span class="o">++</span><span class="p">){</span></div><div class='line' id='LC314'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="nx">chr</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">[</span><span class="nx">i</span><span class="p">];</span></div><div class='line' id='LC315'><br/></div><div class='line' id='LC316'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">.</span><span class="nx">length</span> <span class="o">==</span> <span class="mi">2</span> <span class="o">&amp;&amp;</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">[</span><span class="mi">1</span><span class="p">]</span> <span class="o">==</span> <span class="s1">&#39;\u0000&#39;</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC317'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">emit</span><span class="p">(</span><span class="s1">&#39;close&#39;</span><span class="p">);</span></div><div class='line' id='LC318'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="s1">&#39;&#39;</span><span class="p">;</span></div><div class='line' id='LC319'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span></div><div class='line' id='LC320'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span><span class="p">;</span></div><div class='line' id='LC321'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC322'><br/></div><div class='line' id='LC323'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">i</span> <span class="o">===</span> <span class="mi">0</span><span class="p">){</span></div><div class='line' id='LC324'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">chr</span> <span class="o">!=</span> <span class="s1">&#39;\u0000&#39;</span><span class="p">)</span></div><div class='line' id='LC325'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">error</span><span class="p">(</span><span class="s1">&#39;Bad framing. Expected null byte as first frame&#39;</span><span class="p">);</span></div><div class='line' id='LC326'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">else</span></div><div class='line' id='LC327'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">continue</span><span class="p">;</span></div><div class='line' id='LC328'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC329'><br/></div><div class='line' id='LC330'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">if</span> <span class="p">(</span><span class="nx">chr</span> <span class="o">==</span> <span class="s1">&#39;\ufffd&#39;</span><span class="p">){</span></div><div class='line' id='LC331'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">emit</span><span class="p">(</span><span class="s1">&#39;data&#39;</span><span class="p">,</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">.</span><span class="nx">substr</span><span class="p">(</span><span class="mi">1</span><span class="p">,</span> <span class="nx">i</span> <span class="o">-</span> <span class="mi">1</span><span class="p">));</span></div><div class='line' id='LC332'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">buffer</span><span class="p">.</span><span class="nx">substr</span><span class="p">(</span><span class="nx">i</span> <span class="o">+</span> <span class="mi">1</span><span class="p">);</span></div><div class='line' id='LC333'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span></div><div class='line' id='LC334'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="k">return</span> <span class="k">this</span><span class="p">.</span><span class="nx">parse</span><span class="p">();</span></div><div class='line' id='LC335'>&nbsp;&nbsp;&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC336'>&nbsp;&nbsp;<span class="p">}</span></div><div class='line' id='LC337'><span class="p">};</span></div><div class='line' id='LC338'><br/></div><div class='line' id='LC339'><span class="cm">/**</span></div><div class='line' id='LC340'><span class="cm"> * Handles an error</span></div><div class='line' id='LC341'><span class="cm"> *</span></div><div class='line' id='LC342'><span class="cm"> * @api private</span></div><div class='line' id='LC343'><span class="cm"> */</span></div><div class='line' id='LC344'><br/></div><div class='line' id='LC345'><span class="nx">Parser</span><span class="p">.</span><span class="nx">prototype</span><span class="p">.</span><span class="nx">error</span> <span class="o">=</span> <span class="kd">function</span> <span class="p">(</span><span class="nx">reason</span><span class="p">)</span> <span class="p">{</span></div><div class='line' id='LC346'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">buffer</span> <span class="o">=</span> <span class="s1">&#39;&#39;</span><span class="p">;</span></div><div class='line' id='LC347'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span></div><div class='line' id='LC348'>&nbsp;&nbsp;<span class="k">this</span><span class="p">.</span><span class="nx">emit</span><span class="p">(</span><span class="s1">&#39;error&#39;</span><span class="p">,</span> <span class="nx">reason</span><span class="p">);</span></div><div class='line' id='LC349'>&nbsp;&nbsp;<span class="k">return</span> <span class="k">this</span><span class="p">;</span></div><div class='line' id='LC350'><span class="p">};</span></div><div class='line' id='LC351'><br/></div></pre></div>
              
            
          </td>
        </tr>
      </table>
    
  </div>


          </div>
        </div>
      </div>
    </div>
  

  </div>


<div class="frame frame-loading" style="display:none;" data-tree-list-url="/LearnBoost/socket.io/tree-list/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40" data-blob-url-prefix="/LearnBoost/socket.io/blob/4d66f78ca2e3001a554bfc6c3e8a42ed47619f40">
  <img src="https://a248.e.akamai.net/assets.github.com/images/modules/ajax/big_spinner_336699.gif" height="32" width="32">
</div>

    </div>
  
      
    </div>

    <!--**************
     FOOTER
     **************-->
    <div id="footer" >
      <div class="upper_footer">
        <div class="site" class="clearfix">

        <!--[if IE]><h4 id="blacktocat_ie">GitHub Links</h4><![endif]-->
        <![if !IE]><h4 id="blacktocat">GitHub Links</h4><![endif]>

        <ul class="footer_nav">
          <h4>GitHub</h4>
          <li><a href="https://github.com/about">About</a></li>
          <li><a href="https://github.com/blog">Blog</a></li>
          <li><a href="https://github.com/features">Features</a></li>
          <li><a href="https://github.com/contact">Contact &amp; Support</a></li>
          <li><a href="https://github.com/training">Training</a></li>
          <li><a href="http://status.github.com/">Site Status</a></li>
        </ul>

        <ul class="footer_nav">
          <h4>Tools</h4>
          <li><a href="http://mac.github.com/">GitHub for Mac</a></li>
          <li><a href="http://mobile.github.com/">GitHub:Issues for iPhone</a></li>
          <li><a href="https://gist.github.com">Gist: Code Snippets</a></li>
          <li><a href="http://fi.github.com/">Enterprise Install</a></li>
          <li><a href="http://jobs.github.com/">Job Board</a></li>
        </ul>

        <ul class="footer_nav">
          <h4>Extras</h4>
          <li><a href="http://shop.github.com/">GitHub Shop</a></li>
          <li><a href="http://octodex.github.com/">The Octodex</a></li>
        </ul>

        <ul class="footer_nav">
          <h4>Documentation</h4>
          <li><a href="http://help.github.com/">GitHub Help</a></li>
          <li><a href="http://developer.github.com/">Developer API</a></li>
          <li><a href="http://github.github.com/github-flavored-markdown/">GitHub Flavored Markdown</a></li>
          <li><a href="http://pages.github.com/">GitHub Pages</a></li>
        </ul>

        </div><!-- /.site -->
      </div><!-- /.upper_footer -->

      <div class="lower_footer">
        <div class="site" class="clearfix">

        <!--[if IE]><div id="legal_ie"><![endif]-->
        <![if !IE]><div id="legal"><![endif]>
              
              <ul>
                <li><a href="https://github.com/site/terms">Terms of Service</a></li>
                <li><a href="https://github.com/site/privacy">Privacy</a></li>
                <li><a href="https://github.com/security">Security</a></li>
              </ul>
              

              <p>&copy; 2011 <span id="_rrt" title="0.27992s from fe4.rs.github.com">GitHub</span> Inc. All rights reserved.</p>
            </div><!-- /#legal or /#legal_ie-->

          
          <div class="sponsor">
              <a href="http://www.rackspace.com" class="logo">
                <img alt="Dedicated Server" height="36" src="https://a248.e.akamai.net/assets.github.com/images/modules/footer/rackspace_logo.png?v2" width="38" />
              </a>
              Powered by the <a href="http://www.rackspace.com ">Dedicated
              Servers</a> and<br/> <a href="http://www.rackspacecloud.com">Cloud
              Computing</a> of Rackspace Hosting<span>&reg;</span>
          </div>
          
        </div><!-- /.site -->
      </div><!-- /.lower_footer -->
    </div><!-- /#footer -->

    

<div id="keyboard_shortcuts_pane" class="instapaper_ignore readability-extra" style="display:none">
  <h2>Keyboard Shortcuts <small><a href="#" class="js-see-all-keyboard-shortcuts">(see all)</a></small></h2>

  <div class="columns threecols">
    <div class="column first">
      <h3>Site wide shortcuts</h3>
      <dl class="keyboard-mappings">
        <dt>s</dt>
        <dd>Focus site search</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>?</dt>
        <dd>Bring up this help dialog</dd>
      </dl>
    </div><!-- /.column.first -->

    <div class="column middle" style='display:none'>
      <h3>Commit list</h3>
      <dl class="keyboard-mappings">
        <dt>j</dt>
        <dd>Move selected down</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>k</dt>
        <dd>Move selected up</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>t</dt>
        <dd>Open tree</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>p</dt>
        <dd>Open parent</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>c <em>or</em> o <em>or</em> enter</dt>
        <dd>Open commit</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>y</dt>
        <dd>Expand URL to its canonical form</dd>
      </dl>
    </div><!-- /.column.first -->

    <div class="column last" style='display:none'>
      <h3>Pull request list</h3>
      <dl class="keyboard-mappings">
        <dt>j</dt>
        <dd>Move selected down</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>k</dt>
        <dd>Move selected up</dd>
      </dl>
      <dl class="keyboard-mappings">
        <dt>o <em>or</em> enter</dt>
        <dd>Open issue</dd>
      </dl>
    </div><!-- /.columns.last -->

  </div><!-- /.columns.equacols -->

  <div style='display:none'>
    <div class="rule"></div>

    <h3>Issues</h3>

    <div class="columns threecols">
      <div class="column first">
        <dl class="keyboard-mappings">
          <dt>j</dt>
          <dd>Move selected down</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>k</dt>
          <dd>Move selected up</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>x</dt>
          <dd>Toggle select target</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>o <em>or</em> enter</dt>
          <dd>Open issue</dd>
        </dl>
      </div><!-- /.column.first -->
      <div class="column middle">
        <dl class="keyboard-mappings">
          <dt>I</dt>
          <dd>Mark selected as read</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>U</dt>
          <dd>Mark selected as unread</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>e</dt>
          <dd>Close selected</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>y</dt>
          <dd>Remove selected from view</dd>
        </dl>
      </div><!-- /.column.middle -->
      <div class="column last">
        <dl class="keyboard-mappings">
          <dt>c</dt>
          <dd>Create issue</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>l</dt>
          <dd>Create label</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>i</dt>
          <dd>Back to inbox</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>u</dt>
          <dd>Back to issues</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>/</dt>
          <dd>Focus issues search</dd>
        </dl>
      </div>
    </div>
  </div>

  <div style='display:none'>
    <div class="rule"></div>

    <h3>Network Graph</h3>
    <div class="columns equacols">
      <div class="column first">
        <dl class="keyboard-mappings">
          <dt><span class="badmono">←</span> <em>or</em> h</dt>
          <dd>Scroll left</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt><span class="badmono">→</span> <em>or</em> l</dt>
          <dd>Scroll right</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt><span class="badmono">↑</span> <em>or</em> k</dt>
          <dd>Scroll up</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt><span class="badmono">↓</span> <em>or</em> j</dt>
          <dd>Scroll down</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>t</dt>
          <dd>Toggle visibility of head labels</dd>
        </dl>
      </div><!-- /.column.first -->
      <div class="column last">
        <dl class="keyboard-mappings">
          <dt>shift <span class="badmono">←</span> <em>or</em> shift h</dt>
          <dd>Scroll all the way left</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>shift <span class="badmono">→</span> <em>or</em> shift l</dt>
          <dd>Scroll all the way right</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>shift <span class="badmono">↑</span> <em>or</em> shift k</dt>
          <dd>Scroll all the way up</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>shift <span class="badmono">↓</span> <em>or</em> shift j</dt>
          <dd>Scroll all the way down</dd>
        </dl>
      </div><!-- /.column.last -->
    </div>
  </div>

  <div >
    <div class="rule"></div>
    <div class="columns threecols">
      <div class="column first" >
        <h3>Source Code Browsing</h3>
        <dl class="keyboard-mappings">
          <dt>t</dt>
          <dd>Activates the file finder</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>l</dt>
          <dd>Jump to line</dd>
        </dl>
        <dl class="keyboard-mappings">
          <dt>y</dt>
          <dd>Expand URL to its canonical form</dd>
        </dl>
      </div>
    </div>
  </div>
</div>

    <div id="markdown-help" class="instapaper_ignore readability-extra">
  <h2>Markdown Cheat Sheet</h2>

  <div class="cheatsheet-content">

  <div class="mod">
    <div class="col">
      <h3>Format Text</h3>
      <p>Headers</p>
      <pre>
# This is an &lt;h1&gt; tag
## This is an &lt;h2&gt; tag
###### This is an &lt;h6&gt; tag</pre>
     <p>Text styles</p>
     <pre>
*This text will be italic*
_This will also be italic_
**This text will be bold**
__This will also be bold__

*You **can** combine them*
</pre>
    </div>
    <div class="col">
      <h3>Lists</h3>
      <p>Unordered</p>
      <pre>
* Item 1
* Item 2
  * Item 2a
  * Item 2b</pre>
     <p>Ordered</p>
     <pre>
1. Item 1
2. Item 2
3. Item 3
   * Item 3a
   * Item 3b</pre>
    </div>
    <div class="col">
      <h3>Miscellaneous</h3>
      <p>Images</p>
      <pre>
![GitHub Logo](/images/logo.png)
Format: ![Alt Text](url)
</pre>
     <p>Links</p>
     <pre>
http://github.com - automatic!
[GitHub](http://github.com)</pre>
<p>Blockquotes</p>
     <pre>
As Kanye West said:
> We're living the future so
> the present is our past.
</pre>
    </div>
  </div>
  <div class="rule"></div>

  <h3>Code Examples in Markdown</h3>
  <div class="col">
      <p>Syntax highlighting with <a href="http://github.github.com/github-flavored-markdown/" title="GitHub Flavored Markdown" target="_blank">GFM</a></p>
      <pre>
```javascript
function fancyAlert(arg) {
  if(arg) {
    $.facebox({div:'#foo'})
  }
}
```</pre>
    </div>
    <div class="col">
      <p>Or, indent your code 4 spaces</p>
      <pre>
Here is a Python code example
without syntax highlighting:

    def foo:
      if not bar:
        return true</pre>
    </div>
    <div class="col">
      <p>Inline code for comments</p>
      <pre>
I think you should use an
`&lt;addr&gt;` element here instead.</pre>
    </div>
  </div>

  </div>
</div>
    

    
    
    
    <script type="text/javascript">(function(){var d=document;var e=d.createElement("script");e.async=true;e.src="https://d1ros97qkrwjf5.cloudfront.net/16/eum/rum.js";e.type="text/javascript";var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(e,s);})();NREUMQ.push(["nrf2","beacon-1.newrelic.com","2f94e4d8c2",64799,"dw1bEBZcX1RWRhoEClsAGhcMXEQ=",0,282,new Date().getTime()])</script>
  </body>
</html>

