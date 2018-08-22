import _ from 'lodash'
import axios from 'axios'

const KNOWLEDGEBASE_NAME = 'botpress'
// const KNOWLEDGEBASE_NAME = 'JapanBot'

export default class Storage {
  constructor({ bp, config }) {
    this.bp = bp
    this.microsoftQnaMakerApiKey = config.microsoftQnaMakerApiKey

    this.client = axios.create({
      baseURL: 'https://westus.api.cognitive.microsoft.com/qnamaker/v4.0/knowledgebases',
      headers: { 'Ocp-Apim-Subscription-Key': this.microsoftQnaMakerApiKey }
    })
  }

  async initialize() {
    const isBpKnowledgbase = ({ name }) => name === KNOWLEDGEBASE_NAME
    const { data: { knowledgebases: initialKnowledgebases } } = await this.client.get('/')

    if (initialKnowledgebases.find(isBpKnowledgbase)) {
      this.knowledgebaseId = initialKnowledgebases.find(isBpKnowledgbase).id
      return
    }

    await this.client.post('/create', { name: KNOWLEDGEBASE_NAME, qnaList: [], urls: [], files: [] })
    const { data: { knowledgebases } } = await this.client.get('/')
    this.knowledgebaseId = knowledgebases.find(isBpKnowledgbase).id
  }

  async saveQuestion(data, id = null) {
    await this.client.patch(`/${this.knowledgebaseId}`, {
      add: {
        qnaList: [
          {
            id: 0,
            answer: data.answer,
            questions: data.questions,
            source: 'Botpress API-call',
            metadata: _.chain(data)
              .pick(['enabled', 'action', 'redirectFlow', 'redirectNode'])
              .toPairs()
              .map(([name, value]) => ({ name, value }))
              .filter(({ value }) => Boolean(value))
              .value()
          }
        ]
      },
      delete: {
        ids: id ? [id] : []
      }
    })
    return id
  }

  async getQuestion(id) {
    const { data: { qnaDocuments: questions } } = await this.client.get(`/${this.knowledgebaseId}/test/qna/`)
    return questions.find(({ id: qnaId }) => qnaId === id)
  }

  async questionsCount() {
    const { data: { qnaDocuments: questions } } = await this.client.get(`/${this.knowledgebaseId}/test/qna/`)
    return questions.length
  }

  async getQuestions({ limit, offset } = {}) {
    let { data: { qnaDocuments: questions } } = await this.client.get(`/${this.knowledgebaseId}/test/qna/`)
    if (typeof limit !== 'undefined' && typeof offset !== 'undefined') {
      questions = questions.slice(offset, offset + limit)
    }

    return questions.map(({ id, answer, questions, metadata }) => ({
      id,
      data: {
        questions,
        answer,
        ..._.fromPairs(metadata.map(({ name, value }) => [name, value]))
      }
    }))
  }

  async deleteQuestion(id) {
    await this.client.patch(`/${this.knowledgebaseId}`, { delete: { ids: [id] } })
  }
}
