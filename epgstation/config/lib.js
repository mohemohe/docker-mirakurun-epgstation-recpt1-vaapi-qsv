const spawn = require('child_process').spawn;
const execFile = require('child_process').execFile;
const ffmpeg = process.env.FFMPEG;
const ffprobe = process.env.FFPROBE;
const input = process.env.INPUT;
const output = process.env.OUTPUT;
const isDualMono = parseInt(process.env.AUDIOCOMPONENTTYPE, 10) == 2;
const analyzedurationSize = '10M'; // Mirakurun の設定に応じて変更すること
const probesizeSize = '32M'; // Mirakurun の設定に応じて変更すること

/**
 * @param {string} filePath 
 * @returns {Promise<{duration: number, codecs: string[]}>}
 */
const getInfo = (filePath) => {
    return new Promise((resolve, reject) => {
        execFile(ffprobe, ['-v', '0', '-show_format', '-show_streams', '-of', 'json', filePath], (err, stdout) => {
            if (err) {
                reject(err);

                return;
            }

            try {
                const result = JSON.parse(stdout);
                console.error("info:", result);
                resolve({
                    duration: parseFloat(result.format.duration),
                    codecs: result.streams.map((stream) => stream.codec_name),
                });
            } catch (err) {
                reject(err);
            }
        });
    });
};

/**
 * 
 * @param {boolean} copy 
 * @param {string[]} videoOptions 
 * @returns 
 */
const generateArgs = (copy, videoOptions) => {
    const args = [
        '-y',
        '-analyzeduration', analyzedurationSize,
        '-probesize', probesizeSize,
        '-fflags', '+discardcorrupt',
    ];

    if (copy) {
        // 動画と音声をコピー
        args.push(
            '-i', input,

            '-c:v', 'copy',
            '-c:a', 'copy',
        );
    } else {
        args.push(
            // ハードウェアアクセラレーション 設定
            '-hwaccel', 'vaapi',
            '-hwaccel_device', '/dev/dri/card0',
            '-hwaccel_output_format', 'vaapi',

            // input 設定
            '-i', input,

            // メタ情報を先頭に置く
            '-movflags', 'faststart',
            '-ignore_unknown',

            // video 設定
            ...videoOptions,
        );

        // dual mono 設定
        if (isDualMono) {
            args.push(
                '-filter_complex',
                'channelsplit[FL][FR]',
                '-map', '0:v',
                '-map', '[FL]',
                '-map', '[FR]',
                '-metadata:s:a:0', 'language=jpn',
                '-metadata:s:a:1', 'language=eng',

                '-c:a', 'ac3',
                '-ar', '48000',
                '-ab', '256k'
            );
        } else {
            // audio dataをコピー
            args.push(
                '-c:a', 'copy',
                '-bsf:a', 'aac_adtstoasc',
            );
        }
    }

    // 出力ファイル設定
    args.push(
        // テスト用
        // '-t', '30',

        '-f', 'mp4',
        output
    );

    console.error("ffmpeg args:", args.join(" "));

    return args;
}

/**
 * @param {string[]} videoOptions 
 */
const encode = async (copyTargetCodec, videoOptions) => {
    const { duration, codecs } = await getInfo(input);

    // MP4コンテナに入っていたらエンコードしたものと見なしてコピーに切り替える
    const args = generateArgs(codecs.includes(copyTargetCodec), videoOptions);

    const child = spawn(ffmpeg, args);

    /**
     * エンコード進捗表示用に標準出力に進捗情報を吐き出す
     * 出力する JSON
     * {"type":"progress","percent": 0.8, "log": "view log" }
     */
    child.stderr.on('data', data => {
        console.error(String(data));
        let strbyline = String(data).split('\n');
        for (let i = 0; i < strbyline.length; i++) {
            let str = strbyline[i];
            if (str.startsWith('frame')) {
                // 想定log
                // frame= 5159 fps= 11 q=29.0 size=  122624kB time=00:02:51.84 bitrate=5845.8kbits/s dup=19 drop=0 speed=0.372x
                const progress = {};
                const ffmpeg_reg = /frame=\s*(?<frame>\d+)\sfps=\s*(?<fps>\d+(?:\.\d+)?)\sq=\s*(?<q>[+-]?\d+(?:\.\d+)?)\sL?size=\s*(?<size>\d+(?:\.\d+)?)kB\stime=\s*(?<time>\d+[:\.\d+]*)\sbitrate=\s*(?<bitrate>\d+(?:\.\d+)?)kbits\/s(?:\sdup=\s*(?<dup>\d+))?(?:\sdrop=\s*(?<drop>\d+))?\sspeed=\s*(?<speed>\d+(?:\.\d+)?)x/;
                let ffmatch = str.match(ffmpeg_reg);
                /**
                 * match結果
                 * [
                 *   'frame= 5159 fps= 11 q=29.0 size=  122624kB time=00:02:51.84 bitrate=5845.8kbits/s dup=19 drop=0 speed=0.372x',
                 *   '5159',
                 *   '11',
                 *   '29.0',
                 *   '122624',
                 *   '00:02:51.84',
                 *   '5845.8',
                 *   '19',
                 *   '0',
                 *   '0.372',
                 *   index: 0,
                 *   input: 'frame= 5159 fps= 11 q=29.0 size=  122624kB time=00:02:51.84 bitrate=5845.8kbits/s dup=19 drop=0 speed=0.372x    \r',
                 *   groups: [Object: null prototype] {
                 *     frame: '5159',
                 *     fps: '11',
                 *     q: '29.0',
                 *     size: '122624',
                 *     time: '00:02:51.84',
                 *     bitrate: '5845.8',
                 *     dup: '19',
                 *     drop: '0',
                 *     speed: '0.372'
                 *   }
                 * ]
                 */

                // console.error(ffmatch);
                if (ffmatch === null || ffmatch.groups === undefined) continue;

                progress['frame'] = parseInt(ffmatch.groups.frame);
                progress['fps'] = parseFloat(ffmatch.groups.fps);
                progress['q'] = parseFloat(ffmatch.groups.q);
                progress['size'] = (parseInt(ffmatch.groups.size) / 1024).toFixed(1) + "MB";
                progress['time'] = ffmatch.groups.time;
                progress['bitrate'] = parseFloat(ffmatch.groups.bitrate) + "kbps";
                progress['dup'] = ffmatch.groups.dup == null ? 0 : parseInt(ffmatch.groups.dup);
                progress['drop'] = ffmatch.groups.drop == null ? 0 : parseInt(ffmatch.groups.drop);
                progress['speed'] = parseFloat(ffmatch.groups.speed);

                let current = 0;
                const times = progress.time.split(':');
                for (let i = 0; i < times.length; i++) {
                    if (i == 0) {
                        current += parseFloat(times[i]) * 3600;
                    } else if (i == 1) {
                        current += parseFloat(times[i]) * 60;
                    } else if (i == 2) {
                        current += parseFloat(times[i]);
                    }
                }

                // 進捗率 1.0 で 100%
                const percent = current / duration;
                const log =
                    'frame= ' +
                    progress.frame +
                    ' fps=' +
                    progress.fps +
                    ' time=' +
                    progress.time +
                    ' bitrate=' +
                    progress.bitrate +
                    ' size=' +
                    progress.size +
                    ' drop=' +
                    progress.drop +
                    ' speed=' +
                    progress.speed;

                console.log(JSON.stringify({ type: 'progress', percent: percent, log: log }));
            }
        }
    });

    child.on('error', err => {
        console.error(err);
        throw new Error(err);
    });

    process.on('SIGINT', () => {
        child.kill('SIGINT');
    });
};

module.exports = {
    encode,
};
