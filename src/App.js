import React, { Component } from 'react';
import "./App.css";
import {
  Route,
  withRouter,
} from 'react-router-dom';

import UserProfile from './containers/UserProfile/UserProfile'
import HomePage from './containers/HomePage/HomePage'
import LoanShelf from './containers/LoanShelf/LoanShelf'

import Navbar from './components/NavBar/Navbar'

import API from './API'

class App extends Component {

  state = {
    user: null,
    selectedBook: null,
    lastScroll: 0,
    bookResults: [],
    loanedBooks: [],
    loanObj: null,
    pauseScroll: false,
    searchQuery: "",
    suggestions: true,
    resultsOffset: 0,
    renderSignUp: false,
    userTaken: ""
  }

  renderSignUp = () => {
    this.setState({renderSignUp: true})
  }

  setUser = user => {
    this.setState({user})
  }

  login = (username, password) => {
    API.login(username, password)
      .then(user => {
        this.setState({ user: user.user })
        this.props.history.push('/profile')
      })
      .catch(err => {
        console.log('Invalid login caught', err)
        this.setState({loginError: 'Invalid login'})
      })
  }

  logout = () => {
    API.logout().then(() => {
      localStorage.removeItem('authorization')
      this.setState({ user: null })
      this.props.history.push('/')
    }).catch(err => console.log('Error logging out', err))
  }

  componentDidMount() {
    this.getSuggestions()
    this.getLoanedBooks()  
    if (!localStorage.getItem('authorization')) return 
    API.getUser()
      .then(user => {
        this.setState({ user: user.user })
      })
      .catch(err => {
        console.log('Error in getting user', err)
        this.props.history.push('/')
      })
    window.onscroll = this.scrollWatcher
  }

  scrollWatcher = () => {
    if (this.state.suggestions || this.state.pauseScroll || 
      this.props.match.url !== '/')
      { return }
    const doc = document.documentElement
    if ((doc.clientHeight + doc.scrollTop) > (doc.scrollHeight - 500)) {
      this.setState({pauseScroll: true})
      this.getMoreBooks()
    }
  }

  getSuggestions() {
    console.log('here')
    API.getSuggestions()
      .then(books => {
        console.log(books)
        this.updateResults(books)
        this.setState({suggestions: true})
      }).catch(err => 
        console.log('Error in getting suggestions', err))
  }

  currentlyReading = book => {
    let user = {...this.state.user, currently_reading: book}
    this.setState({ user }, () => 
      API.update(this.state.user) 
          .then(user => this.setState({ user: user.user }))
          .catch(err => 
            console.log('error in setting currently reading', err))
    )
  }

  handleWant = book => {
    this.state.user.wishlist.find(
      x => parseInt(x.ISBN_13) === parseInt(book.ISBN_13)
    )
    ?
    this.removeBookFromList(book, 'wishlist')
    :
    this.addBookToList(book, 'wishlist')
  }

  handleFavourite = book => {
    this.state.user.favourite_books.find(
      x => parseInt(x.ISBN_13) === parseInt(book.ISBN_13)
    )
    ?
    this.removeBookFromList(book, 'favourite_books')
    :
    this.addBookToList(book, 'favourite_books')
  }

  handleLoaned = (book, user) => {
    let foundLoan = this.state.loanedBooks.find(x => 
      x.book._id === book._id && x.user._id === user._id)
    if (foundLoan) {
      this.removeLoaned(foundLoan)
    } else {
      API.loan(book, user._id) 
        .then(resp => this.getLoanedBooks())
    }
  }

  getLoanedBooks = () => {
    API.getAllLoanedBooks()
      .then(loans => this.setState({ loanedBooks: loans.loans }))
      .catch(err => console.log('Error caught in get loaned books', err))
  }

  removeLoaned = (loan) => {
    API.deleteFromLoans(loan._id)
    let newLoanList = [...this.state.loanedBooks]
    newLoanList = newLoanList.filter(x => x._id !== loan._id)
    this.setState({
      loanedBooks: newLoanList
    })
  }

  addBookToList = (book, list) => { 
    const newList = [...this.state.user[list], book]
    this.setState( {
      user: { ...this.state.user, [list]: newList }
    }, () => API.update(this.state.user)
        .then(user => this.setState({ user: user.user }))
        .catch(err => console.log('Error in adding book to list', err))
    )
  }

  removeBookFromList = (book, list) => { 
    let newList = [...this.state.user[list]]
    newList = newList.filter(x => 
      parseInt(x.ISBN_13) !== parseInt(book.ISBN_13))
    this.setState({
      user: { ...this.state.user, [list]: newList }
    }, () => API.update(this.state.user)
          .then(user => this.setState({ user: user.user }))
          .catch(err => console.log('Error in removing book from list', err))
    )
  } 

  getBooks = query => {
    console.log(query)
    API.getBooks(query)
      .then(books => {
        this.updateResults(books)
        this.setState({ 
          lastScroll: 0,
          searchQuery: query,
          resultsOffset: 40
        }, this.scrollUp)
        this.props.history.push('/')
      })
      .catch(err => err)
  }

  getMoreBooks = () => {
    const {resultsOffset, searchQuery} = this.state
    API.getBooks(searchQuery, resultsOffset)
      .then(books => {
        let moreBooks = [...this.state.bookResults, ...books]
        this.updateResults(moreBooks)
        this.setState({ 
          resultsOffset: resultsOffset + 40,
          pauseScroll: true 
        }, () => setTimeout( () => 
            this.setState({pauseScroll: false}),
            1500
        ))
      })
      .catch(err => err)
  }

  updateResults = bookResults => {
    this.setState({
      bookResults,
      suggestions: false
    })
  }

  submitSearch = query => {
    this.getBooks(query)
  }

  selectBook = (selectedBook, loanObj) => {
    if (loanObj) {
      this.setState({ 
        selectedBook,
        loanObj,
        lastScroll: document.documentElement.scrollTop,
        renderSignUp: false
    }, this.scrollUp) 
    } else {
      this.setState({ 
        selectedBook, 
        lastScroll: document.documentElement.scrollTop,
        renderSignUp: false
    }, this.scrollUp) 
    }
   
  }

  deselectBook = () => {
    this.setState({ selectedBook: null })
    this.scrollDown()
  }  

  scrollUp = () => {
   let currentScroll = document.documentElement.scrollTop
    if (currentScroll > 0) {
      window.requestAnimationFrame(this.scrollUp);
      window.scrollTo(0, currentScroll - (currentScroll / 5))
    }
  }

  scrollDown = () => {
    let currentScroll = document.documentElement.scrollTop
    if (currentScroll < this.state.lastScroll) {
      window.requestAnimationFrame(this.scrollDown);
      window.scrollTo(0, 
        currentScroll + (this.state.lastScroll / 20  ))
    }
  }

  render() {

    const { user, selectedBook, bookResults, loanedBooks, suggestions, renderSignUp, loginError}
     = this.state

    return (
  
      <div >
        <Route path='/' render={(routerProps) => 
          <Navbar {...routerProps} 
            user={user} login={this.login} logout={this.logout}
            submitSearch={this.submitSearch} 
            renderSignUp={this.renderSignUp}
            loginError={loginError}
          /> }
        />
        
        <div className='main-container'>
          {user &&
            <Route exact path='/profile' render={(routerProps) => 
              <UserProfile {...routerProps}
              user={user}
              currentlyReading={this.currentlyReading}
              handleWant={this.handleWant}
              handleFavourite={this.handleFavourite}
              loanedBooks={loanedBooks}
              selectBook={this.selectBook}
              selectedBook={selectedBook}
              deselectBook={this.deselectBook}
              handleLoaned={this.handleLoaned}
              /> }
            />
          }
          <Route
              exact path='/loanshelf'
              render={(routerProps) => 
                <LoanShelf {...routerProps}
                  loanedBooks={loanedBooks}
                  currentlyReading={this.currentlyReading}
                  deselectBook={this.deselectBook}
                  selectBook={this.selectBook}
                  selectedBook={selectedBook}
                  handleLoaned={this.handleLoaned}
                  handleWant={this.handleWant}
                  handleFavourite={this.handleFavourite}
                  user={user}
                  removeLoaned={this.removeLoaned}
                  findLoanObject={this.findLoanObject}
                  loanObject={this.state.loanObj}
                />
              }
            />
          <Route
            exact path='/'
            render={(routerProps) =>
              <HomePage {...routerProps}
                bookResults={bookResults}
                currentlyReading={this.currentlyReading}
                selectedBook={selectedBook}
                selectBook={this.selectBook}
                deselectBook={this.deselectBook}
                handleWant={this.handleWant}
                handleFavourite={this.handleFavourite}
                renderSignUp={renderSignUp}
                setUser={this.setUser}
                suggestions={suggestions}
                updateResults={this.updateResults}
                user={user}
                handleLoaned={this.handleLoaned}
                loanedBooks={loanedBooks}
                loanObject={this.state.loanObj}
              /> }
            />
            
        </div>
      </div>
      
    );
  }
}

export default withRouter(App)





