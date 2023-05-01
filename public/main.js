"use strict";

var g;

function nextIfOk(resp) {
    g = resp;
    console.log('response received');
    if(resp.status === 200) {
        return resp.json();
    } else {
        throw new Error('Something went wrong on server!');
    }
}

function loginAjax() {
    let uid = $('[name=uid]').val();
    let form = document.getElementById('login_form');
    console.log('form', form);
    let form_data = new FormData(form);
    console.log('data', form_data);
    const req = new Request('/set-uid-ajax/', {method: 'POST',
                                               body: form_data});
    fetch(req)
        .then(nextIfOk)
        .then((resp) => { console.debug(resp);
                          // update page for logged-in user
                          $("#login-uid").text(uid);
                          $("#logged-in").show();
                          $("#not-logged-in").hide();
                        })
        .catch((error) => { console.error(error); });
}

$("#login-ajax").click(loginAjax);

console.log('main.js loaded');




// a simple response handler you can use in raw debugging or demos

function showResponse(resp) {
  console.log('response is: ', resp);
}

// The response handler that the app uses in practice.



$(".followBtn").on('click', function (event) {
    let user = $(".followBtn").attr('name');
    addFollower(user);
  });

function addFollower(user) {
    // $.ajax("/likeAjax/"+tt, {method: 'POST', data: {tt: tt}, success: processAction});
    $.post("/addFollower/"+user, {user: user}).then(processFollow);
}

function processFollow(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    console.log("this worked");
    $('#followers').text("Followers: " + resp.followers);
}

$(".editBioBtn").on('click', function (event){
    let user = $(".editBioBtn").attr('name');
    let bio = $("textarea[name=bio]").val();
    console.log("bio is ", bio);
    $.post("/editBio/" + user, {user, bio}).then(processEditBio);
});

function processEditBio(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    console.log("this worked");
    $('#bio').text(resp.bio);
}