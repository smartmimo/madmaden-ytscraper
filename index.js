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

app.get("/getSong", async (req, res) => {
    const url = `https://youtu.be/${req.query.id}`;
    const song = await ytdl.getInfo(url).catch(e => e)
    res.json({
        url: song.videoDetails.videoId,
        title: (song.videoDetails.media && song.videoDetails.media.song) ? song.videoDetails.media.song : song.videoDetails.title,
        artist: song.videoDetails.media ? song.videoDetails.media.artist || "" : "",
        seconds: parseInt(song.videoDetails.lengthSeconds),
        thumbnail: song.videoDetails.thumbnail.thumbnails[0]
    })
})

app.get("/getStream", async (req, res) => {
    const url = `https://youtu.be/${req.query.id}`;
    
    for await (const chunk of stream(url)) {
        res.write(chunk)
    }
    res.end()
})

app.post("/search", async (req, res)=>{
    if(!req.body.query) return res.status(400).end("Missing params.");
    const result = await axios("https://www.youtube.com/results?search_query=salam");
    try {
        const $ = cheerio.load(result.data);
        var el;
        $("script").each((i, e) => {
            if($(e).html().includes('var ytInitialData')){
                el = $(e);
                return;
            }
        })
        if(!el) throw new Error("Can't find element.");
        eval($(el).html());
        if(!ytInitialData) throw new Error("Wrong element.");

        const items = ytInitialData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(e => Object.keys(e).includes("videoRenderer"))
        const results = []
        for(const elem of items){
            const item = elem.videoRenderer
            results.push({
                id: {
                    videoId: item.videoId
                },
                snippet: {
                    title: item.title.runs[0].text
                }
            })
        }
        res.json(results);
    } catch (error) {
        res.status(400).end(error.message);
    }
})

app.listen(process.env.PORT || 3000)

