const rq = require('request-promise');
const fs = require('fs');
const path = require('path');

const to = require('./to');

class Udemy {
    constructor() {
        this.cookie = null;
        this.token = null;

        this.setCookie();
        this.setToken();
    }

    setCookie() {
        this.cookie = fs.readFileSync('Cookie.txt', { encoding: 'utf8' });
    }

    setToken() {
        const regex = /access_token=(.+?);/gm;
        this.token = regex.exec(this.cookie)[1];
    }

    async getListLecture(course) {
        const [error, info] = await await to(
            rq({
                uri: `https://www.udemy.com/api-2.0/courses/${course}/subscriber-curriculum-items/?page_size=1400&fields[lecture]=title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free&fields[quiz]=title,object_index,is_published,sort_order,type&fields[practice]=title,object_index,is_published,sort_order&fields[chapter]=title,object_index,is_published,sort_order&fields[asset]=title,filename,asset_type,status,time_estimation,is_external&caching_intent=True`,
                method: 'GET',
                json: true,
                headers: {
                    Cookie: this.cookie,
                    'X-Udemy-Authorization': `Bearer ${this.token}`,
                },
            })
        );

        if (error) return Promise.reject(error);
        const lectures = info.results.filter(item => item._class === 'lecture');
        return Promise.resolve(lectures);
    }

    async getVideoLecture(idCouse, lecture) {
        const { id, title } = lecture;
        try {
            const { asset } = await rq({
                uri: `https://www.udemy.com/api-2.0/users/me/subscribed-courses/${idCouse}/lectures/${id}/?fields[lecture]=asset,description,download_url,is_free,last_watched_second&fields[asset]=asset_type,length,media_license_token,course_is_drmed,media_sources,captions,thumbnail_sprite,slides,slide_urls,download_urls`,
                method: 'GET',
                json: true,
                headers: {
                    Cookie: this.cookie,
                    'X-Udemy-Authorization': `Bearer ${this.token}`,
                },
            });

            return Promise.resolve({
                id,
                title,
                media_sources: asset.media_sources,
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getAllLecture(course) {
        let error, lectures, listLectures;

        [error, lectures] = await to(this.getListLecture(course));

        if (error) {
            return Promise.reject(error);
        }

        [error, listLectures] = await to(
            Promise.all(
                lectures.map(lecture => this.getVideoLecture(course, lecture))
            )
        );

        if (error) {
            return Promise.reject(error);
        }

        return Promise.resolve(listLectures);
    }

    async downloadFile(course) {
        console.log('Get Lectures ... ');
        let [error, listLectures] = await to(this.getAllLecture(course));

        if (error) {
            return Promise.reject(error);
        }

        const pathDir = path.join(__dirname, String(course));

        fs.mkdirSync(pathDir);
        let i = 1;
        for (const item of listLectures) {
            const { title, media_sources } = item;
            const fileName = path.join(pathDir, `${i}. ${title}.mp4`);
            console.log(`Downloading ${title}`);
            await this.download(fileName, media_sources[0].src);
            i++;
        }
        console.log('Done !');
        return Promise.resolve(listLectures);
    }

    async download(pathFile, uri) {
        try {
            const res = await rq({
                uri,
                encoding: null,
            });

            fs.writeFileSync(pathFile, res);
            return Promise.resolve(true);
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

module.exports = new Udemy();
