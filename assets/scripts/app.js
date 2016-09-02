$(document).ready(function() {

  $('.button-collapse').sideNav();
  $('.parallax').parallax();

  $('#menu').find('.card').on('click', function() {
    let price = $(this).find('.price').text()
    let title = $(this).find('.card-title').text()

    addToCart(price, title);
  });

  // find price & title
  var addToCart = function(price, title) {
    $('#cart').append(`<tr><td>${title}</td>
    <td>${price}</td></tr>`)
    updateTotal(price);
  }
  var updateTotal = function(price) {
    let price_value = getValue(price)
    let current_subtotal = getValue($('#subtotal').text())
    let current_tax = getValue($('#tax').text())
    let current_total = getValue($('#total').text())
    current_subtotal += price_value
    current_tax = current_subtotal * 0.085
    current_total = current_subtotal + current_tax


    $('#subtotal').text('$' + current_subtotal.toFixed(2))
    $('#tax').text('$' + current_tax.toFixed(2))
    $('#total').text('$' + current_total.toFixed(2))
  }
  var getValue = function(value) {
    return parseFloat(value.replace(/\$/, ""))
  }


});
