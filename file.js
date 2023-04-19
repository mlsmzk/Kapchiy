function timeString(dateObj) {
    if( !dateObj) {
        dateObj = new Date();
    }
    // convert val to two-digit string
    d2 = (val) => val < 10 ? '0'+val : ''+val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh+mm+ss
}

function isAuthorizedToView(viewerId, ownerId) {
    console.log('auth?', viewerId, ownerId);
    return viewerId === ownerId;
}