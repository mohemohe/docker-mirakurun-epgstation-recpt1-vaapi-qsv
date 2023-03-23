const { encode } = require('./lib');

const videoOptions = [
    // video 設定
    '-vf', 'deinterlace_vaapi,scale_vaapi=w=-2:h=1080',
    '-c:v', 'h264_vaapi',
    '-qp', '24',
];

(async () => {
    await encode("h264", videoOptions);
})();
