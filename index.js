const axios = require("axios");
const cheerio = require("cheerio");
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

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
                }
            })
        }
        res.json(results);
    } catch (error) {
        res.status(400).end(error.message);
    }
})

app.listen(process.env.PORT || 3000)

