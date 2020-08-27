
/**
 * THIS FILE SHOULD BE ACCESSED THROUGH https://api.readlight.me/common/api/pwdreset.js
 */

function getParam(sname) {
    var params = location.search.substr(location.search.indexOf("?") + 1);
    var sval = "";
    params = params.split("&");
    for (var i = 0; i < params.length; i++) {
        temp = params[i].split("=");
        if ([temp[0]] == sname) { sval = temp[1]; }
    }
    return sval == null ? "" : decodeURI(sval);
}

window.onload = function() {
    var token,email,pwd,pwdchk,alerttext,resetform;

    token = document.getElementById("token");
    email = document.getElementById("email");
    pwd = document.getElementById("pwd");
    pwdchk = document.getElementById("pwdchk");
    alerttext = document.getElementById("alerttext");
    resetform = document.getElementById("resetform");
    token.value = decodeURIComponent(decodeURIComponent(getParam("token")));
    email.value = decodeURIComponent(decodeURIComponent(getParam("email")));

    
    if (token.value === "" || email.value === "") {
        alert("필수정보가 누락되었습니다.\n정상적인 링크로 접근해주세요.");
        location.href="https://readlight.me";
    } 

    pwdchk.oninput = function() {
        alerttext.style.visibility="visible";
        if (pwd.value !== pwdchk.value || pwd.value=="") {
            alerttext.innerHTML= "비밀번호 확인이 일치하지 않습니다.";
            alerttext.style.color= "#FF0000";
        }
        else {
            alerttext.innerHTML= "비밀번호 확인이 일치합니다.";
            alerttext.style.color= "#04B431";
        }
    }
    pwd.oninput = pwdchk.oninput;

    resetform.onsubmit = function() {
        var password_regex = /^.*(?=^.{8,15}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=]).*$/;
        if (!password_regex.test(pwd.value)){
            alert("올바른 비밀번호 형식이 아닙니다.");
            return false;
        }
        if (pwd.value !== pwdchk.value) {
            alert("비밀번호 확인이 일치하지 않습니다.");
            return false;
        }
        var formData = $("form[id=resetform]").serialize();
        $.ajax({
            url: "https://api.readlight.me/auth/pwdreset",
            type: "POST",
            data: formData,
            success: function (data) {
                alert("비밀번호 변경이 완료되었습니다.");
                location.href="https://readlight.me";
            },
            error: function (request, status, error) {
                if (request.status === 409) {
                    alert("유효하지 않은 계정이거나, 링크가 만료되었습니다.\n비밀번호 재설정 페이지에서 다시 요청해주세요.");
                    location.href="https://readlight.me";
                } else if (request.status === 423) {
                    alert("계정이 정지되어 비밀번호 변경이 제한됩니다.");
                    location.href="https://readlight.me";
                } else if (request.status === 500) {
                    alert("일시적인 서버에러가 발생했습니다.\n잠시후 다시시도 해주세요.");
                } else {
                    alert("알수없는 에러가 발생하였습니다.\n정상적인 링크로 접근해주세요.");
                }
            }
        });
        return false;
    }
}
