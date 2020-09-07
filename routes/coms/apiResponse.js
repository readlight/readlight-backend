var _response = { "result" : { "statusCode" : 500, "body" : {"msg":"ERR_SERVER_FAILED_TEMPORARILY"}, "output" : null, "error" : "SERVER_RESPONSE_INVALID" }};
const responseFunction = async (res, statusCode, body, output, error) => {
    if (!(statusCode && body && output !== undefined)) throw("ERR_SERVER_BACKEND_SYNTAX_FAILED");
    if (!(error === undefined || error === null)) console.error(error);
    _response.result.statusCode = statusCode;
    _response.result.body = body;
    _response.result.output = output;
    _response.result.error = error;
    res.status(statusCode).json(_response);
    return _response;
};

export default responseFunction;