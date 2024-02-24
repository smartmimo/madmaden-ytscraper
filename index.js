const axios = require("axios");
const cheerio = require("cheerio");
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const ytdl = require('ytdl-core')
const FFmpeg = require('fluent-ffmpeg')
const { PassThrough } = require('stream')
const fs = require('fs')

app.use(bodyParser.json());

function stream(uri, opt) {
    opt = {
        ...opt,
        videoFormat: 'mp4',
        quality: 'highest',
        audioFormat: 'mp3',
        filter(format) {
            return format.container === opt.videoFormat && format.audioBitrate
        }
    }

    const video = ytdl(uri, opt)
    const { file, audioFormat } = opt
    const stream = file ? fs.createWriteStream(file) : new PassThrough()
    const ffmpeg = new FFmpeg(video)

    process.nextTick(() => {
        const output = ffmpeg.format(audioFormat).pipe(stream)

        ffmpeg.once('error', error => stream.emit('error', error))
        output.once('error', error => {
            video.end()
            stream.emit('error', error)
        })
    })

    stream.video = video
    stream.ffmpeg = ffmpeg

    return stream
}

app.get("/probe", (req, res) => res.end("ok"));

app.get("/getSong", async (req, res) => {
    const url = `https://youtu.be/${req.query.id}`;
    const song = await ytdl.getInfo(url).catch(e => e)
    if (!song.videoDetails) return res.json({ error: "Couldn't get song." }).status(403)
    res.json({
        url: song.videoDetails.videoId,
        title: (song.videoDetails.media && song.videoDetails.media.song) ? song.videoDetails.media.song : song.videoDetails.title,
        artist: song.videoDetails.media ? song.videoDetails.media.artist || "" : "",
        seconds: parseInt(song.videoDetails.lengthSeconds),
        thumbnail: song.videoDetails.thumbnails.pop().url
        // thumbnail: song.videoDetails.thumbnail.thumbnails.pop().url
    })
})

app.get("/getNext", async (req, res) => {
    const url = `https://youtu.be/${req.query.id}`;
    const song = await ytdl.getInfo(url).catch(e => e)
    if (!song.related_videos) res.json({ error: "Couldn't get related videos." }).status(403)
    res.json(song.related_videos ? song.related_videos.map(e => e.id) : []);
})

app.get("/getStream", async (req, res) => {
    const url = `https://youtu.be/${req.query.id}`;

    // const fileStream = fs.createWriteStream("zabi.mp3", { encoding: "binary" });
    res.type("mp3");
    const streym = stream(url);
    streym.pipe(res);
    // fs.writeFileSync("zabi.mp3", fileStream);
    // fileStream.pipe(res);
    // res.end(fileStream);
})

app.get("/search", async (req, res) => {
    if (!req.query.query) return res.status(400).end("Missing params.");
    const result = await axios("https://www.youtube.com/results?search_query=" + req.query.query);
    try {
        const $ = cheerio.load(result.data);
        var el;
        $("script").each((i, e) => {
            if ($(e).html().includes('var ytInitialData')) {
                el = $(e);
                return;
            }
        })
        if (!el) throw new Error("Can't find element.");
        eval($(el).html());
        if (!ytInitialData) throw new Error("Wrong element.");

        const items = ytInitialData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(e => Object.keys(e).includes("videoRenderer"))
        const results = []
        for (const elem of items) {
            const item = elem.videoRenderer
            results.push({
                id: {
                    videoId: item.videoId
                },
                snippet: {
                    title: item.title.runs[0].text,
                    durationString: item.thumbnailOverlays.find(e => e.thumbnailOverlayTimeStatusRenderer).text.simpleText,
                    thumbnails: {
                        "high": item.thumbnail.thumbnails.sort((a, b) => b.width - a.width)[0]
                    }
                }
            })
        }
        res.json({ items: results });
    } catch (error) {
        res.status(400).end(error.message);
    }
})

const server = app.listen(process.env.PORT || 3000, () => {
    const privateIp = getIPAddress()
    axios("https://api.ipify.org?format=text").then(res => {
        const externalIp = res.data;
        console.log(`Public: \x1b[33m${externalIp}:${server.address().port}\x1b[0m\nPrivate: \x1b[33m${privateIp}:${server.address().port}\x1b[0m`)
    })
}).on('error', e => {
    console.log(e.message)
})


function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];

        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                return alias.address;
        }
    }
    return '0.0.0.0';
}