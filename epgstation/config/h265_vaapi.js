const { encode } = require('./lib');

const videoOptions = [
    // video 設定
    '-vf', 'deinterlace_vaapi,scale_vaapi=w=-2:h=1080',
    '-c:v', 'hevc_vaapi',
    '-preset', 'veryslow',
    '-vsync', '1',

    // ChatGPT-3.5に聞いたらこのパラメータが最適だってよ
    '-global_quality', '26',
    '-q:v', '26',
    '-qp', '0',
    '-b:v', '0',
    '-maxrate:v', '0',
];

(async () => {
    await encode("hevc", videoOptions);
})();
