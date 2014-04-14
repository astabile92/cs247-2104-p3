// Initial code by Borui Wang, updated by Graham Roth
// For CS247, Spring 2014

(function() {

  var cur_video_blob = null;
  
  var video_blobs = [];
  
  var user_is_typing = false;
  var typing_start = 0;
  var video_stream = null;
  var media_recorder = null;
  var video_dimensions = [160, 120];
  var fb_instance;

  $(document).ready(function(){
    connect_to_chat_firebase();
    connect_webcam();
  });

  function connect_to_chat_firebase(){
    /* Include your Firebase link here!*/
    
    //fb_instance = new Firebase("https://gsroth-p3-v1.firebaseio.com");
    fb_instance = new Firebase("https://blazing-fire-2106.firebaseio.com/");

    // generate new chatroom id or use existing id
    var url_segments = document.location.href.split("/#");
    if(url_segments[1]){
      fb_chat_room_id = url_segments[1];
    }else{
      fb_chat_room_id = Math.random().toString(36).substring(7);
    }
    display_msg({m:"Share this url with your friend to join this chat: "+ document.location.origin+"/#"+fb_chat_room_id,c:"red"})

    // set up variables to access firebase data structure
    var fb_new_chat_room = fb_instance.child('chatrooms').child(fb_chat_room_id);
    var fb_instance_users = fb_new_chat_room.child('users');
    var fb_instance_stream = fb_new_chat_room.child('stream');
    var my_color = "#"+((1<<24)*Math.random()|0).toString(16);

    // listen to events
    fb_instance_users.on("child_added",function(snapshot){
      display_msg({m:snapshot.val().name+" joined the room",c: snapshot.val().c});
    });
    fb_instance_stream.on("child_added",function(snapshot){
      display_msg(snapshot.val());
    });

    // block until username is answered
    var username = window.prompt("Welcome, warrior! please declare your name?");
    if(!username){
      username = "anonymous"+Math.floor(Math.random()*1111);
    }
    fb_instance_users.push({ name: username,c: my_color});
    $("#waiting").remove();

    // bind submission box
    $("#submission input").keydown(function( event ) {    
      if (event.which == 13 && user_is_typing) {			//Pushed Enter
        user_is_typing = false;
        cur_time = new Date().getTime();
        if (media_recorder && cur_time - typing_start > 1500) {
          media_recorder.stop();	//Manually stopping the recorder causes its 'ondataavailable' function to execute
          console.log("stopped media recorder");
          /*
           * Problem: once the media recorder is stopped, it takes a few milliseconds to convert the video to base64 (called in 'ondataavailable').
		   *   So, if you push to FB immediately, 'cur_video_blob' will be null, and no video gets sent along.
           * To fix this, the following code adds a slight delay to the message send: once 'cur_video_blob' exists, the full message gets sent along
           * This is probably bug-prone but it works for now and the delay isn't noticeable
          */
          var message_str = username+": "+$(this).val();
          var send_message = setInterval(function() {
            if ( cur_video_blob ) {
              fb_instance_stream.push({m:message_str, v:cur_video_blob, c: my_color});
              clearInterval(send_message);	//user's message sent, so stop executing this function!
            }
          }, 100);	//execute this function every 100 milliseconds (could be made smaller, but delay is not noticeable)
          
        } else {
          console.log("sending non-video message");
          fb_instance_stream.push({m:username+": " +$(this).val(), c: my_color});
        }
        $(this).val("");
        
      } else if (!user_is_typing) {
        user_is_typing = true;
        typing_start = new Date().getTime(); 	//milliseconds since 1970
        if (video_stream) {
          cur_video_blob = null;
          makeMediaRecorder();	//initializes 'media_recorder'
          media_recorder.start(9000);  //records a maximum 9 seconds of video, then 'ondataavailable' gets called
          console.log("created media recorder");
        }
      }
    });
  }

  // creates a message node and appends it to the conversation
  function display_msg(data){
    //$("#conversation").append("<div class='msg' style='color:"+data.c+"'>"+data.m+"</div>");
    if(data.v){
      // for video element
      var video = document.createElement("video");
      video.className = "msg_video";
      video.autoplay = true;
      video.controls = false; // optional
      video.loop = true;
      video.width = 120;

      var source = document.createElement("source");
      source.src =  URL.createObjectURL(base64_to_blob(data.v));
      source.type =  "video/webm";

      video.appendChild(source);

      // for gif instead, use this code below and change mediaRecorder.mimeType in onMediaSuccess below
      // var video = document.createElement("img");
      // video.src = URL.createObjectURL(base64_to_blob(data.v));

      document.getElementById("conversation").appendChild(video);
    }
    $("#conversation").append("<div class='msg' style='color:"+data.c+"'>"+data.m+"</div>");
    // Scroll to the bottom every time we display a new message
    scroll_to_bottom(0);
  }

  function scroll_to_bottom(wait_time){
    // scroll to bottom of div
    setTimeout(function(){
      $("html, body").animate({ scrollTop: $(document).height() }, 200);
    },wait_time);
  }

  function connect_webcam(){
    // we're only recording video, not audio
    var mediaConstraints = {
      video: true,
      audio: false
    };

    // callback for when we get video stream from user.
    var onMediaSuccess = function(stream) {
      video_stream = stream;
      
      // create video element, attach webcam stream to video element
      var video_width= video_dimensions[0];
      var video_height= video_dimensions[1];
      var webcam_stream = document.getElementById('webcam_stream');
      var video = document.createElement('video');
      webcam_stream.innerHTML = "";
      // adds these properties to the video
      video = mergeProps(video, {
          controls: false,
          width: video_width,
          height: video_height,
          src: URL.createObjectURL(stream)
      });
      video.play();
      webcam_stream.appendChild(video);

      // counter
      var time = 0;
      var second_counter = document.getElementById('second_counter');
      var second_counter_update = setInterval(function(){
        second_counter.innerHTML = time++;
      },1000);
	/*
      // now record stream in 5 seconds interval
      var video_container = document.getElementById('video_container');
      var mediaRecorder = new MediaStreamRecorder(stream);
      var index = 1;

      mediaRecorder.mimeType = 'video/webm';
      // mediaRecorder.mimeType = 'image/gif';
      // make recorded media smaller to save some traffic (80 * 60 pixels, 3*24 frames)
      mediaRecorder.video_width = video_width/2;
      mediaRecorder.video_height = video_height/2;

      mediaRecorder.ondataavailable = function (blob) {
          //console.log("new data available!");
          video_container.innerHTML = "";

          // convert data into base 64 blocks
          blob_to_base64(blob,function(b64_data){
            cur_video_blob = b64_data;
          });
      };
	*/
	  //makeMediaRecorder();
	/*
      setInterval( function() {
        mediaRecorder.stop();
        mediaRecorder.start(3000);
      }, 3000 );
    */
      console.log("connected to media stream!");
    }
    
    // callback if there is an error when we try and get the video stream
    var onMediaError = function(e) {
      video_stream = null;
      media_recorder = null;
      console.error('media error', e);
    }

    // get video stream from user. see https://github.com/streamproc/MediaStreamRecorder
    navigator.getUserMedia(mediaConstraints, onMediaSuccess, onMediaError);
  }

  function makeMediaRecorder() {
    if (!video_stream) {
      console.log("couldn't create media recorder: no video stream");
    }
    
    // now record stream in 5 seconds interval
    var video_container = document.getElementById('video_container');
    var mediaRecorder = new MediaStreamRecorder(video_stream);
    var index = 1;
    var video_width = video_dimensions[0];
    var video_height = video_dimensions[1];

    mediaRecorder.mimeType = 'video/webm';
    // mediaRecorder.mimeType = 'image/gif';
    // make recorded media smaller to save some traffic (80 * 60 pixels, 3*24 frames)
    mediaRecorder.video_width = video_width/2;
    mediaRecorder.video_height = video_height/2;
    mediaRecorder.ondataavailable = function (blob) {
      console.log("new data available!");
      video_container.innerHTML = "";

      // convert data into base 64 blocks
      blob_to_base64(blob,function(b64_data){
        cur_video_blob = b64_data;
        console.log("finished callback, cur_video_blob now set");
      });
    };
    
    media_recorder = mediaRecorder;
  }

  // check to see if a message qualifies to be replaced with video.
  var has_emotions = function(msg){
    var options = ["lol",":)",":("];
    for(var i=0;i<options.length;i++){
      if(msg.indexOf(options[i])!= -1){
        return true;
      }
    }
    return false;
  }


  // some handy methods for converting blob to base 64 and vice versa
  // for performance bench mark, please refer to http://jsperf.com/blob-base64-conversion/5
  // note useing String.fromCharCode.apply can cause callstack error
  var blob_to_base64 = function(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      callback(base64);
    };
    reader.readAsDataURL(blob);
  };

  var base64_to_blob = function(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    var blob = new Blob([view]);
    return blob;
  };

})();
